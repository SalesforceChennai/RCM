import { query } from '../db.ts';
import { executeSafeReadOnlyQuery, generateAndExecuteSqlWithLangChain } from './sqlAgent.ts';
import {
  getThreadHistory,
  getThreadWorkflowState,
  saveThreadTurn,
  type ChatTurn,
  type WorkflowState
} from './memory.ts';
import {
  classifyIntentWithLlm,
  normalizeDate,
  normalizeTime,
  type IntentClassificationResult,
  type ExtractedEntities
} from './nlu.ts';
import {
  executeCreateAppointment,
  executeCreatePatient,
  executeCreateClaim,
  executeUpdateClaimStatus,
  executeRecordPayment
} from './rcmTools.ts';
import {
  detectSymptomFromText,
  findBestDoctorAndCheckAvailability
} from './symptomRecommendation.ts';

export interface ChatMessageRequest {
  message: string;
  conversationId?: string;
  threadId?: string;
  thread_id?: string;
  confirmedAction?: {
    type: string;
    payload: any;
  };
}

export interface AssistantResponse {
  success: boolean;
  message: string;
  thread_id?: string;
  data?: any;
  action?: {
    type: string;
    target?: string;
    payload?: any;
  } | null;
  requiresConfirmation?: boolean;
  sqlExecuted?: string;
  steps?: string[];
  stats?: Array<{ label: string; value: string | number; change?: string; trend?: 'up' | 'down' | 'neutral' }>;
  tableData?: {
    headers: string[];
    rows: Array<Record<string, any>>;
  };
}

export interface AppointmentDraft {
  patientName?: string;
  patientId?: string;
  doctorName?: string;
  doctorId?: string;
  departmentName?: string;
  departmentId?: string;
  date?: string;
  time?: string;
  reasonForVisit?: string;
  symptoms?: string;
}

export interface ConversationContext {
  lastPatientId?: string;
  lastPatientName?: string;
  lastClaimId?: string;
  lastDoctorId?: string;
  lastDoctorName?: string;
  lastAppointmentId?: string;
  lastAppointmentCode?: string;
  lastAppointmentDate?: string;
  lastAppointmentTime?: string;
  lastAppointments?: any[];
  lastAction?: any;
  appointmentDraft?: AppointmentDraft | null;
  pendingConfirmationPayload?: any;
  workflowState?: WorkflowState | null;
}

const conversationSessions = new Map<string, ConversationContext>();

export function getSessionContext(conversationId?: string): ConversationContext {
  const id = conversationId || 'default-session';
  if (!conversationSessions.has(id)) {
    conversationSessions.set(id, {});
  }
  return conversationSessions.get(id)!;
}

// ============================================================================
// DOCTOR RESOLUTION (STRICT VALIDATION FROM REAL POSTGRESQL RECORDS)
// ============================================================================

async function resolveDoctor(doctorName?: string | null, departmentName?: string | null): Promise<any> {
  if (doctorName) {
    const cleanDoc = doctorName.replace(/Dr\.?\s*/i, '').trim().toLowerCase();
    // 1. Exact or partial match on name
    let dRes = await query(
      `SELECT * FROM doctors WHERE LOWER(name) = $1 OR LOWER(name) = $2 OR LOWER(name) LIKE $3 LIMIT 1`,
      [cleanDoc, `dr. ${cleanDoc}`, `%${cleanDoc}%`]
    );
    if (dRes.rows.length > 0) return dRes.rows[0];

    // 2. Partial match on specialization or department
    dRes = await query(
      `SELECT * FROM doctors WHERE LOWER(specialization) LIKE $1 OR LOWER(department_name) LIKE $1 LIMIT 1`,
      [`%${cleanDoc}%`]
    );
    if (dRes.rows.length > 0) return dRes.rows[0];
  }

  if (departmentName) {
    const dRes = await query(
      `SELECT * FROM doctors WHERE LOWER(department_name) LIKE $1 ORDER BY name ASC LIMIT 1`,
      [`%${departmentName.toLowerCase().trim()}%`]
    );
    if (dRes.rows.length > 0) return dRes.rows[0];
  }

  const firstDocRes = await query(`SELECT * FROM doctors ORDER BY name ASC LIMIT 1`);
  return firstDocRes.rows[0] || null;
}

// ============================================================================
// MAIN ASSISTANT ENGINE
// ============================================================================

export async function processAssistantMessage(req: ChatMessageRequest): Promise<AssistantResponse> {
  const { message, confirmedAction } = req;
  const threadId = req.thread_id || req.threadId || req.conversationId || 'default-thread';
  const ctx = getSessionContext(threadId);
  const trimmed = (message || '').trim();

  // Load workflow state from PostgreSQL checkpointer, fall back to session context
  let workflowState: WorkflowState = (await getThreadWorkflowState(threadId)) || ctx.workflowState || {
    activeIntent: null,
    workflowStatus: 'idle',
    patientName: null,
    patientId: null,
    patientCode: null,
    doctorName: null,
    doctorId: null,
    departmentName: null,
    appointmentDate: null,
    appointmentTime: null,
    pendingAction: null,
    registrationDraft: null
  };
  ctx.workflowState = workflowState;

  // 1. If this is an execution of an already confirmed action (UI button click)
  if (confirmedAction) {
    const res = await executeConfirmedAction(confirmedAction, ctx, workflowState);
    ctx.pendingConfirmationPayload = null;
    await saveThreadTurn(threadId, trimmed || 'Confirmed action', res, 'action', workflowState);
    return { ...res, thread_id: threadId };
  }

  // 2. Load conversation history from PostgreSQL checkpointer
  const history = await getThreadHistory(threadId);

  // 3. Classify intent and extract entities using Groq LLM (with fallback)
  const nluResult = await classifyIntentWithLlm(trimmed, history, workflowState);

  // 4. Dispatch to intent handler
  const response = await handleStructuredIntent(nluResult, trimmed, ctx, workflowState, history);

  // 5. Update session context with modified workflow state
  ctx.workflowState = workflowState;

  // 6. Save conversation turn and workflow state to PostgreSQL checkpointer
  await saveThreadTurn(threadId, trimmed, response, undefined, workflowState);

  return { ...response, thread_id: threadId };
}

// ============================================================================
// STRUCTURED INTENT ROUTER & HANDLERS
// ============================================================================

async function handleStructuredIntent(
  nlu: IntentClassificationResult,
  rawMessage: string,
  ctx: ConversationContext,
  workflowState: WorkflowState,
  history: ChatTurn[]
): Promise<AssistantResponse> {
  const { intent, entities, normalizedQuery } = nlu;

  switch (intent) {
    case 'action.confirm':
      return handleActionConfirm(ctx, workflowState);

    case 'action.cancel':
      return handleActionCancel(ctx, workflowState);

    case 'navigation.open':
      return handleNavigation(entities);

    case 'appointment.create':
      return handleAppointmentCreate(entities, ctx, workflowState, rawMessage);

    case 'patient.registration':
      return handlePatientRegistration(entities, ctx, workflowState, rawMessage);

    case 'patient.check_status':
      return handlePatientCheckStatus(entities, workflowState);

    case 'patient.doctor_query':
    case 'patient.appointments':
      return handlePatientDoctorOrAppointmentQuery(nlu, rawMessage, ctx, workflowState, history);

    case 'appointment.list':
      if (entities.patientName) {
        return handlePatientDoctorOrAppointmentQuery(nlu, rawMessage, ctx, workflowState, history);
      }
      return handleAppointmentList(entities);

    case 'appointment.count':
      return handleAppointmentCount();

    case 'patient.search':
      if (/\b(doctor|dr|consult|consults|consulting|appointment|appointments|when|yaaru)\b/i.test(rawMessage)) {
        return handlePatientDoctorOrAppointmentQuery(nlu, rawMessage, ctx, workflowState, history);
      }
      return handlePatientSearch(entities, ctx);

    case 'patient.count':
      return handlePatientCount();

    case 'patient.list':
      return handlePatientList(entities);

    case 'claim.list':
      return handleClaimList(entities);

    case 'claim.count':
      return handleClaimCount();

    case 'denial.count':
      return handleDenialCount();

    case 'denial.list':
      return handleDenialList();

    case 'payment.summary':
      return handlePaymentSummary();

    case 'payment.list':
      return handlePaymentList();

    case 'general.chat':
    case 'clarification.required':
      return handleConversationalGeneral(nlu, rawMessage, history);

    case 'sql.query':
    default:
      return handleSqlQuery(normalizedQuery || rawMessage, history);
  }
}

// ============================================================================
// CONVERSATIONAL & GENERAL CHAT (GROQ LLM POWERED)
// ============================================================================

async function handleConversationalGeneral(
  nlu: IntentClassificationResult,
  rawMessage: string,
  _history: ChatTurn[]
): Promise<AssistantResponse> {
  if (nlu.conversationalResponse) {
    return {
      success: true,
      message: nlu.conversationalResponse,
      steps: ['Processed with Groq LLM']
    };
  }

  try {
    const { getLangChainChatModel } = await import('./sqlAgent.ts');
    const model = await getLangChainChatModel();
    if (model) {
      const prompt = `You are MediCare RCM AI Assistant, an empathetic, professional, and concise healthcare Revenue Cycle Management assistant.
User message: "${rawMessage}"
Provide a natural, concise, and helpful response (1-3 sentences) explaining how you can help or answering their query directly.`;
      const res = await model.invoke(prompt);
      const text = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
      return {
        success: true,
        message: text.trim(),
        steps: ['Generated conversational response with Groq LLM']
      };
    }
  } catch (err: any) {
    console.warn('[Assistant] Error generating conversational response:', err?.message);
  }

  return {
    success: true,
    message: nlu.clarificationMessage || "Hello! I am your MediCare RCM Assistant. I can help you search patient records, schedule appointments with matching specialists, review billing claims, and track revenue collections. How can I help you today?",
    steps: ['Ready to assist']
  };
}

// ============================================================================
// 1. APPOINTMENT CREATION (CONVERSATIONAL & CONFIRMATION GATED)
// ============================================================================

async function handleAppointmentCreate(
  entities: ExtractedEntities,
  ctx: ConversationContext,
  workflowState: WorkflowState,
  _rawMessage: string
): Promise<AssistantResponse> {
  workflowState.activeIntent = 'appointment.create';

  // Merge newly detected entities into the workflowState
  if (entities.patientName) workflowState.patientName = entities.patientName;
  if (entities.patientId) workflowState.patientId = entities.patientId;
  if (entities.doctorName) workflowState.doctorName = entities.doctorName;
  if (entities.departmentName) workflowState.departmentName = entities.departmentName;
  if (entities.date) workflowState.appointmentDate = normalizeDate(entities.date) || entities.date;
  if (entities.time) workflowState.appointmentTime = normalizeTime(entities.time) || entities.time;
  if (entities.reasonForVisit) workflowState.reasonForVisit = entities.reasonForVisit;
  if (entities.symptoms) workflowState.symptoms = entities.symptoms;

  // Detect symptoms or medical consultation reasons from rawMessage if not already captured
  const rawSymptom = detectSymptomFromText(_rawMessage);
  if (rawSymptom) {
    workflowState.symptoms = rawSymptom.symptomName;
    workflowState.reasonForVisit = rawSymptom.symptomName;
    workflowState.recommendedSpecialty = rawSymptom.matchedDefinition.specialtyName;
  }

  // Carry forward previously mentioned patient if not in workflowState
  if (!workflowState.patientName && !workflowState.patientId && ctx.lastPatientName) {
    workflowState.patientName = ctx.lastPatientName;
    workflowState.patientId = ctx.lastPatientId;
  }

  const activeSymptom = workflowState.symptoms || workflowState.reasonForVisit;

  // Carry forward previously mentioned doctor ONLY IF user is not providing a new symptom
  if (!workflowState.doctorName && !workflowState.departmentName && !activeSymptom && ctx.lastDoctorName) {
    workflowState.doctorName = ctx.lastDoctorName;
    workflowState.doctorId = ctx.lastDoctorId;
  }

  // Look up patient in PostgreSQL if name is provided but ID/Code is not yet resolved
  let patientObj: any = null;
  if (workflowState.patientId) {
    const pRes = await query(
      `SELECT * FROM patients WHERE id = $1 OR LOWER(patient_id) = LOWER($1) LIMIT 1`,
      [workflowState.patientId]
    );
    if (pRes.rows.length > 0) patientObj = pRes.rows[0];
  }

  if (!patientObj && workflowState.patientName) {
    const searchPat = workflowState.patientName.toLowerCase().trim();
    const pRes = await query(
      `SELECT * FROM patients WHERE LOWER(first_name) = $1 OR LOWER(last_name) = $1 OR LOWER(CONCAT(first_name, ' ', last_name)) = $1 OR LOWER(first_name) LIKE $2 LIMIT 1`,
      [searchPat, `%${searchPat}%`]
    );
    if (pRes.rows.length > 0) {
      patientObj = pRes.rows[0];
    }
  }

  if (patientObj) {
    workflowState.patientId = patientObj.id;
    workflowState.patientCode = patientObj.patient_id;
    workflowState.patientName = `${patientObj.first_name} ${patientObj.last_name}`.trim();
    ctx.lastPatientId = patientObj.id;
    ctx.lastPatientName = workflowState.patientName;
  }

  // --------------------------------------------------------------------------
  // SYMPTOM-BASED INTELLIGENT ROUTING & AUTOMATIC BOOKING CONTINUATION
  // When a symptom is provided (e.g. "neck pain", "joint pain", "tooth pain"):
  // --------------------------------------------------------------------------
  if (activeSymptom) {
    const match = await findBestDoctorAndCheckAvailability(
      activeSymptom,
      workflowState.appointmentDate,
      workflowState.appointmentTime,
      workflowState.doctorName
    );

    workflowState.recommendedSpecialty = match.specialtyDef.specialtyName;
    if (match.selectedDoctor) {
      workflowState.recommendedDoctorNames = [match.selectedDoctor.name];
    }

    // 1. Specialty not supported in hospital database (e.g. Dentistry for tooth pain)
    if (!match.isHospitalSupported) {
      let unsuppMsg = `Based on your consultation reason (**${activeSymptom}**), **${match.specialtyDef.specialtyName}** is the appropriate clinical specialty.\n\n`;
      unsuppMsg += `### Hospital Department Status:\n${match.specialtyDef.alternativeExplanation}\n\n`;
      unsuppMsg += `${match.specialtyDef.urgentWarning}\n\n`;

      if (match.alternativeGeneralMedicineDocs && match.alternativeGeneralMedicineDocs.length > 0) {
        unsuppMsg += `### Available Physicians in General Medicine for Initial Evaluation & Pain Relief:\n\n`;
        match.alternativeGeneralMedicineDocs.forEach((doc, idx) => {
          unsuppMsg += `${idx + 1}. **${doc.name}** (${doc.specialization})\n`;
          unsuppMsg += `   - **Working Hours:** ${doc.workingHours.start} – ${doc.workingHours.end}\n`;
          unsuppMsg += `   - **Available Slots:** ${doc.availableSlots.slice(0, 6).join(', ')}\n\n`;
        });
        unsuppMsg += `Would you like me to schedule an initial evaluation with one of our General Medicine physicians?`;
      }

      return {
        success: true,
        message: unsuppMsg,
        steps: [
          `Identified specialty: ${match.specialtyDef.specialtyName}`,
          `Checked hospital department records: Department not supported`,
          `Retrieved General Medicine physicians as alternative evaluation option`
        ]
      };
    }

    // 2. Doctor selection from database
    const doctorObj = match.selectedDoctor;
    if (!doctorObj) {
      return {
        success: true,
        message: `Currently, our hospital records do not have an active provider registered under **${match.specialtyDef.specialtyName}**. Our General Medicine team can provide an initial clinical evaluation.`,
        steps: ['Queried doctors table', 'No provider found for specialty']
      };
    }

    // 3. Check for genuinely missing fields
    const hasPatient = Boolean(workflowState.patientName);
    const hasDate = Boolean(workflowState.appointmentDate);
    const hasTime = Boolean(workflowState.appointmentTime);

    if (!hasPatient) {
      workflowState.workflowStatus = 'collecting_appointment_details';
      const dateContext = hasDate && hasTime ? ` on **${workflowState.appointmentDate} at ${workflowState.appointmentTime}**` : '';
      return {
        success: true,
        message: `For **${activeSymptom}**, **${match.specialtyDef.specialtyName}** with **${doctorObj.name}** (${doctorObj.specialization})${dateContext} is available.\n\nCould you please provide the patient's name to proceed with booking?`,
        steps: [
          `Inferred specialty: ${match.specialtyDef.specialtyName}`,
          `Selected physician: ${doctorObj.name}`,
          `Prompting for missing patient name`
        ]
      };
    }

    if (!hasDate || !hasTime) {
      workflowState.workflowStatus = 'collecting_appointment_details';
      return {
        success: true,
        message: `I have noted patient **${workflowState.patientName}** for **${activeSymptom}** (recommended specialty: **${match.specialtyDef.specialtyName}** with **${doctorObj.name}**).\n\nWhat date and time would you like to schedule? (e.g. tomorrow at 10:00 AM)`,
        steps: [
          `Inferred specialty: ${match.specialtyDef.specialtyName}`,
          `Selected physician: ${doctorObj.name}`,
          `Prompting for appointment date and time`
        ]
      };
    }

    // 4. Availability conflict check
    if (!match.isAvailableAtRequestedTime) {
      workflowState.workflowStatus = 'collecting_appointment_details';
      let conflictMsg = `Based on your consultation reason (**${activeSymptom}**), **${match.specialtyDef.specialtyName}** is the recommended specialty.\n\n`;
      conflictMsg += `However, **${doctorObj.name}** is not available at **${workflowState.appointmentTime}** on **${workflowState.appointmentDate}** (${match.timeConflictReason}).\n\n`;

      if (match.doctorOpenSlots.length > 0) {
        conflictMsg += `- **Available slots for ${doctorObj.name} on ${workflowState.appointmentDate}:** ${match.doctorOpenSlots.slice(0, 8).join(', ')}\n`;
      }
      if (match.alternativeDoctorsInDepartment.length > 0) {
        const altDoc = match.alternativeDoctorsInDepartment[0];
        conflictMsg += `- **Alternative in ${match.department?.name || 'Department'}:** **${altDoc.name}** (${altDoc.specialization}) is available on **${workflowState.appointmentDate} at ${workflowState.appointmentTime}**.\n`;
      }

      conflictMsg += `\nWould you like to reschedule with ${doctorObj.name} at an open slot, or book with ${match.alternativeDoctorsInDepartment[0]?.name || 'an alternative physician'}?`;

      return {
        success: true,
        message: conflictMsg,
        steps: [
          `Inferred specialty: ${match.specialtyDef.specialtyName}`,
          `Checked availability for ${doctorObj.name}`,
          `Slot conflict detected: ${match.timeConflictReason}`,
          `Presented available slots and alternative physician`
        ]
      };
    }

    // 5. Patient existence check in PostgreSQL
    if (!patientObj) {
      workflowState.workflowStatus = 'patient_not_found_prompt';
      return {
        success: true,
        message: `I checked our records, but patient **${workflowState.patientName}** was not found in the database.\n\nWould you like to register **${workflowState.patientName}** as a new patient, or search for an existing patient with another name?`,
        steps: [
          'Validated appointment booking details',
          `Queried PostgreSQL for patient '${workflowState.patientName}'`,
          'Patient record does not exist in database',
          'Prompting user to register new patient'
        ]
      };
    }

    // 6. Complete Information Present: Present Booking Summary & Request Confirmation
    workflowState.doctorId = doctorObj.id;
    workflowState.doctorName = doctorObj.name;
    workflowState.departmentId = doctorObj.departmentId;
    workflowState.departmentName = doctorObj.departmentName;
    ctx.lastDoctorId = doctorObj.id;
    ctx.lastDoctorName = doctorObj.name;

    const payload = {
      patientId: patientObj.id,
      patientName: workflowState.patientName,
      patientCode: patientObj.patient_id,
      doctorId: doctorObj.id,
      doctorName: doctorObj.name,
      departmentId: doctorObj.departmentId || null,
      departmentName: doctorObj.departmentName || 'Orthopedics',
      appointmentDate: workflowState.appointmentDate!,
      appointmentTime: workflowState.appointmentTime!,
      appointmentType: 'Consultation',
      reasonForVisit: activeSymptom
    };

    workflowState.workflowStatus = 'awaiting_appointment_confirmation';
    workflowState.pendingAction = {
      type: 'create_appointment',
      payload
    };
    ctx.pendingConfirmationPayload = payload;

    let summaryMsg = `Based on your consultation reason (**${activeSymptom}**), **${match.specialtyDef.specialtyName}** is the recommended specialty.\n\n`;
    summaryMsg += `I have matched **${doctorObj.name}** (${doctorObj.specialization}) in **${doctorObj.departmentName}**, who is available on **${payload.appointmentDate} at ${payload.appointmentTime}**.\n\n`;
    summaryMsg += `### 📋 Appointment Booking Summary:\n`;
    summaryMsg += `- **Patient:** ${payload.patientName} (${payload.patientCode})\n`;
    summaryMsg += `- **Reason for Visit:** ${payload.reasonForVisit}\n`;
    summaryMsg += `- **Specialty / Department:** ${payload.departmentName}\n`;
    summaryMsg += `- **Doctor:** ${payload.doctorName} (${doctorObj.specialization})\n`;
    summaryMsg += `- **Date:** ${payload.appointmentDate}\n`;
    summaryMsg += `- **Time:** ${payload.appointmentTime}\n`;
    summaryMsg += `- **Appointment Type:** Consultation\n\n`;
    if (/chest pain|cardiac|heart attack|shortness of breath|difficulty breathing|stroke|loss of consciousness/i.test(activeSymptom)) {
      summaryMsg += `> ⚠️ **Emergency Notice:** If you are experiencing acute chest pain or severe distress, please seek immediate emergency care.\n\n`;
    }
    summaryMsg += `Do you want me to book this appointment in the system?`;

    return {
      success: true,
      message: summaryMsg,
      requiresConfirmation: true,
      action: {
        type: 'create_appointment',
        payload
      },
      steps: [
        `Understood symptom / consultation reason: '${activeSymptom}'`,
        `Inferred recommended specialty: ${match.specialtyDef.specialtyName}`,
        `Matched doctor from PostgreSQL: ${doctorObj.name}`,
        `Verified real-time availability on ${payload.appointmentDate} at ${payload.appointmentTime}`,
        `Prepared complete appointment booking summary`,
        `Awaiting user confirmation before saving to database`
      ]
    };
  }

  // --------------------------------------------------------------------------
  // DIRECT DOCTOR SPECIFICATION (User specified doctor explicitly, without symptom)
  // --------------------------------------------------------------------------
  let doctorObj: any = null;
  if (workflowState.doctorName) {
    doctorObj = await resolveDoctor(workflowState.doctorName, workflowState.departmentName);
    if (doctorObj) {
      workflowState.doctorId = doctorObj.id;
      workflowState.doctorName = doctorObj.name;
      workflowState.departmentName = doctorObj.department_name;
      workflowState.departmentId = doctorObj.department_id || null;
      ctx.lastDoctorId = doctorObj.id;
      ctx.lastDoctorName = doctorObj.name;
    }
  }

  // Check what fields are still missing
  const hasPatient = Boolean(workflowState.patientName || workflowState.patientId);
  const hasDoctor = Boolean(workflowState.doctorName && doctorObj);
  const hasDate = Boolean(workflowState.appointmentDate);
  const hasTime = Boolean(workflowState.appointmentTime);

  const missingFields: string[] = [];
  if (!hasPatient) missingFields.push('patient');
  if (!hasDoctor) missingFields.push('doctor');
  if (!hasDate) missingFields.push('date');
  if (!hasTime) missingFields.push('time');
  workflowState.missingRequiredFields = missingFields;

  if (missingFields.length > 0) {
    workflowState.workflowStatus = 'collecting_appointment_details';
    let clarification = '';

    if (!hasPatient && !hasDoctor && !hasDate && !hasTime) {
      clarification = "I'd be glad to help schedule an appointment! Could you please share the patient's name, consultation reason or symptoms, and desired date and time?";
    } else if (hasPatient && !hasDoctor && (!hasDate || !hasTime)) {
      const patDisplay = workflowState.patientCode ? `${workflowState.patientName} (${workflowState.patientCode})` : workflowState.patientName;
      clarification = `I've noted patient **${patDisplay}**. What medical symptoms or reason are you scheduling this consultation for, or which doctor would you like to consult? Please also let me know your preferred date and time.`;
    } else if (hasPatient && hasDoctor && (!hasDate || !hasTime)) {
      clarification = `I have patient **${workflowState.patientName}** with **${doctorObj?.name || workflowState.doctorName}** (${doctorObj?.department_name || workflowState.departmentName}). What date and time would you like to schedule? (e.g. 2026-10-13 at 10:00 AM)`;
    } else if (!hasDoctor && hasPatient && hasDate && hasTime) {
      clarification = `Got it for patient **${workflowState.patientName}** on **${workflowState.appointmentDate} at ${workflowState.appointmentTime}**. What symptoms or medical reason are you seeking consultation for, or which doctor would you like to schedule with?`;
    } else if (!hasPatient && (hasDoctor || hasDate || hasTime)) {
      clarification = `Could you please provide the patient's name for this appointment?`;
    } else {
      clarification = `Could you please provide the remaining appointment details (${missingFields.join(', ')})?`;
    }

    return {
      success: true,
      message: clarification,
      steps: ['Understood appointment booking intent', 'Collecting remaining appointment details']
    };
  }

  // All 4 required fields are present: Check if Patient exists in PostgreSQL
  if (!patientObj) {
    workflowState.workflowStatus = 'patient_not_found_prompt';
    return {
      success: true,
      message: `I checked our records, but patient **${workflowState.patientName}** was not found in the database.\n\nWould you like to register **${workflowState.patientName}** as a new patient, or search for an existing patient with another name?`,
      steps: [
        'Validated appointment booking details',
        `Queried PostgreSQL for patient '${workflowState.patientName}'`,
        'Patient record does not exist in database',
        'Prompting user to register new patient'
      ]
    };
  }

  if (!doctorObj) {
    return {
      success: true,
      message: `We could not find a doctor matching "${workflowState.doctorName}" in our active provider records. Please choose from our available hospital physicians (e.g., Dr. Rajesh Sharma or Dr. Sunita Joshi in Orthopedics, Dr. Arvind Swaminathan in Cardiology, or Dr. Vikram Malhotra in General Medicine).`,
      steps: [
        'Queried PostgreSQL for doctor record',
        'Doctor not found in active providers',
        'Offering available alternatives'
      ]
    };
  }

  const payload = {
    patientId: patientObj.id,
    patientName: workflowState.patientName,
    patientCode: patientObj.patient_id,
    doctorId: doctorObj.id,
    doctorName: doctorObj.name,
    departmentId: doctorObj.department_id || null,
    departmentName: doctorObj.department_name || 'General Medicine',
    appointmentDate: workflowState.appointmentDate!,
    appointmentTime: workflowState.appointmentTime!,
    appointmentType: 'Consultation',
    reasonForVisit: workflowState.reasonForVisit || 'Consultation'
  };

  workflowState.workflowStatus = 'awaiting_appointment_confirmation';
  workflowState.pendingAction = {
    type: 'create_appointment',
    payload
  };
  ctx.pendingConfirmationPayload = payload;

  return {
    success: true,
    message: `Here is the appointment summary:\n\n- **Patient:** ${payload.patientName} (${payload.patientCode})\n- **Doctor:** ${payload.doctorName} (${payload.departmentName})\n- **Date:** ${payload.appointmentDate}\n- **Time:** ${payload.appointmentTime}\n- **Reason for Visit:** ${payload.reasonForVisit}\n\nDo you want me to book this appointment in the system?`,
    requiresConfirmation: true,
    action: {
      type: 'create_appointment',
      payload
    },
    steps: [
      'Resolved patient & doctor in PostgreSQL',
      'Prepared appointment summary',
      'Awaiting confirmation...'
    ]
  };
}

// ============================================================================
// 2. PATIENT REGISTRATION WORKFLOW
// ============================================================================

async function handlePatientRegistration(
  entities: ExtractedEntities,
  ctx: ConversationContext,
  workflowState: WorkflowState,
  _rawMessage: string
): Promise<AssistantResponse> {
  workflowState.activeIntent = 'patient.registration';
  workflowState.registrationDraft = workflowState.registrationDraft || {};
  const draft = workflowState.registrationDraft;

  // If first name not set, populate from workflowState.patientName
  if (!draft.firstName) {
    const rawPat = entities.patientName || workflowState.patientName || '';
    if (rawPat) {
      const parts = rawPat.trim().split(/\s+/);
      draft.firstName = parts[0];
      draft.lastName = parts.slice(1).join(' ') || '';
    }
  }

  if (entities.firstName) draft.firstName = entities.firstName;
  if (entities.lastName) draft.lastName = entities.lastName;
  if (entities.dob) draft.dob = normalizeDate(entities.dob) || entities.dob;
  if (entities.gender) draft.gender = entities.gender;
  if (entities.phone) draft.phone = entities.phone;
  if (entities.email) draft.email = entities.email;
  if (entities.address) draft.address = entities.address;

  // Check required fields (firstName, dob, gender, phone)
  const missingReg: string[] = [];
  if (!draft.firstName) missingReg.push('First Name');
  if (!draft.dob) missingReg.push('Date of Birth');
  if (!draft.gender) missingReg.push('Gender');
  if (!draft.phone) missingReg.push('Phone Number');

  if (missingReg.length > 0) {
    workflowState.workflowStatus = 'collecting_registration_details';
    return {
      success: true,
      message: `To register **${draft.firstName || 'the patient'}** as a new patient, please provide the following required details:\n\n${missingReg.map(f => `- **${f}**`).join('\n')}\n\n*(For example: DOB: 1995-05-15, Gender: Male, Phone: 9876543210)*`,
      steps: [
        'Initiating patient registration workflow',
        `Collecting missing required fields (${missingReg.join(', ')})`
      ]
    };
  }

  // All required fields present
  const payload = {
    firstName: draft.firstName!,
    lastName: draft.lastName || 'Patient',
    dob: draft.dob!,
    gender: draft.gender || 'Other',
    phone: draft.phone!,
    email: draft.email || '',
    address: draft.address || ''
  };

  workflowState.workflowStatus = 'awaiting_registration_confirmation';
  workflowState.pendingAction = {
    type: 'create_patient',
    payload
  };
  ctx.pendingConfirmationPayload = payload;

  return {
    success: true,
    message: `Here are the patient registration details to confirm:\n\n- **Name:** ${payload.firstName} ${payload.lastName}\n- **Date of Birth:** ${payload.dob}\n- **Gender:** ${payload.gender}\n- **Phone:** ${payload.phone}${payload.email ? `\n- **Email:** ${payload.email}` : ''}\n\nShall I register and save this patient in PostgreSQL?`,
    requiresConfirmation: true,
    action: {
      type: 'create_patient',
      payload
    },
    steps: [
      'Validated patient registration details',
      'Prepared registration payload',
      'Awaiting registration confirmation...'
    ]
  };
}

// ============================================================================
// 3. PATIENT CHECK STATUS (TRUTHFUL POSTGRESQL VERIFICATION)
// ============================================================================

async function handlePatientCheckStatus(
  entities: ExtractedEntities,
  workflowState: WorkflowState
): Promise<AssistantResponse> {
  const targetName = (entities.patientName || workflowState.patientName || 'Shero').trim();
  const searchPattern = `%${targetName.toLowerCase()}%`;

  const pRes = await query(
    `SELECT id, patient_id, first_name, last_name, dob, gender, phone, email, created_at
     FROM patients
     WHERE LOWER(first_name) LIKE $1 OR LOWER(last_name) LIKE $1 OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [searchPattern]
  );

  if (pRes.rows.length > 0) {
    const p = pRes.rows[0];
    return {
      success: true,
      message: `Yes, patient **${p.first_name} ${p.last_name}** is registered in the database with Medical Record Number **${p.patient_id}** (DOB: ${p.dob}, Phone: ${p.phone}).`,
      data: p,
      stats: [{ label: 'Patient MRN', value: p.patient_id }],
      steps: ['Searching PostgreSQL patients table...', 'Verified existing patient record in database']
    };
  }

  // Not found in PostgreSQL - explain truthfully and offer to continue registration
  const contextNote = workflowState.doctorName && workflowState.appointmentDate
    ? ` I still have your appointment booking details noted (Doctor: Dr. ${workflowState.doctorName.replace(/^Dr\.?\s*/i, '')}, Date: ${workflowState.appointmentDate}, Time: ${workflowState.appointmentTime}).`
    : '';

  return {
    success: true,
    message: `No, patient **${targetName}** has not yet been registered in the PostgreSQL database.${contextNote}\n\nWould you like me to register **${targetName}** as a new patient now?`,
    steps: ['Searching PostgreSQL patients table...', 'No record found in database']
  };
}

// ============================================================================
// 4. ACTION CONFIRMATION & CANCELLATION
// ============================================================================

async function handleActionConfirm(
  ctx: ConversationContext,
  workflowState: WorkflowState
): Promise<AssistantResponse> {
  const pending = workflowState.pendingAction || (ctx.pendingConfirmationPayload ? {
    type: ctx.pendingConfirmationPayload.appointmentDate ? 'create_appointment' : 'create_patient',
    payload: ctx.pendingConfirmationPayload
  } : null);

  if (!pending) {
    // If user says "confirm" / "book it" and we have all 4 appointment fields
    if (workflowState.patientName && workflowState.doctorName && workflowState.appointmentDate && workflowState.appointmentTime) {
      return handleAppointmentCreate({}, ctx, workflowState, 'book it');
    }

    return {
      success: true,
      message: "There is no pending action waiting for confirmation. How can I help you today?",
      steps: ['Checking pending actions...', 'Ready']
    };
  }

  return executeConfirmedAction(pending, ctx, workflowState);
}

async function handleActionCancel(
  ctx: ConversationContext,
  workflowState: WorkflowState
): Promise<AssistantResponse> {
  const prevStatus = workflowState.workflowStatus;
  workflowState.workflowStatus = 'idle';
  workflowState.pendingAction = null;
  workflowState.registrationDraft = null;
  ctx.pendingConfirmationPayload = null;

  return {
    success: true,
    message: prevStatus?.includes('registration')
      ? "Patient registration has been cancelled. No changes were made to the database."
      : "Appointment booking has been cancelled. No changes were made to the database.",
    steps: ['Action cancelled']
  };
}

// ============================================================================
// 3. NAVIGATION INTENT
// ============================================================================

const NAV_MAP: Record<string, { target: string; title: string }> = {
  patients: { target: 'patients', title: 'Patients' },
  'new-appointment': { target: 'new-appointment', title: 'New Appointment' },
  dashboard: { target: 'dashboard', title: 'Scheduling Dashboard' },
  registration: { target: 'registration', title: 'Patient Registration' },
  insurance: { target: 'insurance', title: 'Insurance Verification' },
  'prior-auth': { target: 'prior-auth', title: 'Prior Authorization' },
  'charge-capture': { target: 'charge-capture', title: 'Charge Capture' },
  'medical-coding': { target: 'medical-coding', title: 'Medical Coding' },
  'claim-creation': { target: 'claim-creation', title: 'Claim Creation' },
  'payment-prediction': { target: 'payment-prediction', title: 'Payment Prediction' },
  doctors: { target: 'doctors', title: 'Doctors' },
  departments: { target: 'departments', title: 'Departments' },
  calendar: { target: 'calendar', title: 'Calendar' }
};

function handleNavigation(entities: ExtractedEntities): AssistantResponse {
  const targetKey = (entities.navigationTarget || 'dashboard').toLowerCase();
  const nav = NAV_MAP[targetKey] || { target: targetKey, title: targetKey };

  return {
    success: true,
    message: `Opening the ${nav.title} page for you.`,
    action: {
      type: 'navigate',
      target: nav.target
    },
    steps: ['Understanding navigation request...', `Navigating to ${nav.title}...`]
  };
}

// ============================================================================
// 4. PATIENT QUERIES (COUNT, SEARCH, LIST)
// ============================================================================

async function handlePatientCount(): Promise<AssistantResponse> {
  const sql = `SELECT COUNT(*) as count FROM patients`;
  const res = await executeSafeReadOnlyQuery(sql);
  const count = Number(res.rows?.[0]?.count ?? 0);

  return {
    success: true,
    message: `You currently have **${count}** registered patients in the system.`,
    sqlExecuted: sql,
    stats: [{ label: 'Registered Patients', value: count, trend: 'up' }],
    steps: ['Understanding request...', 'Querying Patients Database...', 'Preparing response...']
  };
}

async function handlePatientSearch(
  entities: ExtractedEntities,
  ctx: ConversationContext
): Promise<AssistantResponse> {
  const searchTerm = (entities.patientName || entities.searchQuery || '').trim();

  let sql = `
    SELECT id, patient_id, first_name, last_name, dob, gender, phone, email, address, blood_group
    FROM patients
  `;
  const params: any[] = [];

  if (searchTerm) {
    sql += ` WHERE LOWER(first_name) LIKE $1 OR LOWER(last_name) LIKE $1 OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $1 OR LOWER(patient_id) LIKE $1`;
    params.push(`%${searchTerm.toLowerCase()}%`);
  }

  sql += ` ORDER BY patient_id ASC LIMIT 10`;

  const res = await executeSafeReadOnlyQuery(sql, params);
  const rows = res.rows || [];

  if (rows.length === 0) {
    return {
      success: true,
      message: searchTerm
        ? `No patient records found matching "${searchTerm}" in the database.`
        : `No patient records found.`,
      sqlExecuted: sql,
      data: []
    };
  }

  const p = rows[0];
  ctx.lastPatientId = p.id;
  ctx.lastPatientName = `${p.first_name} ${p.last_name}`;

  // Check appointments on file for this patient
  const apptsRes = await executeSafeReadOnlyQuery(
    `SELECT a.appointment_code, a.appointment_date, a.appointment_time, a.status, d.name as doctor_name, COALESCE(dept.name, d.department_name, a.department_name, 'General Medicine') as department_name
     FROM appointments a
     LEFT JOIN doctors d ON a.doctor_id = d.id
     LEFT JOIN departments dept ON a.department_id = dept.id
     WHERE a.patient_id = $1
     ORDER BY a.appointment_date DESC LIMIT 3`,
    [p.id]
  );
  const patientAppts = apptsRes.rows || [];
  let appointmentInfo = '';
  if (patientAppts.length > 0) {
    const apt = patientAppts[0];
    ctx.lastDoctorName = apt.doctor_name;
    ctx.lastAppointmentCode = apt.appointment_code;
    ctx.lastAppointmentDate = apt.appointment_date;
    ctx.lastAppointmentTime = apt.appointment_time;
    appointmentInfo = `\n\n**Appointments on file (${patientAppts.length}):**\n` +
      `- **Consulting Doctor:** ${apt.doctor_name || 'N/A'} (${apt.department_name})\n` +
      `- **Recent/Upcoming:** ${apt.appointment_date} at ${apt.appointment_time} (Status: ${apt.status}, Code: ${apt.appointment_code})`;
  }

  return {
    success: true,
    message: rows.length === 1
      ? `Found patient record for **${p.first_name} ${p.last_name}** (${p.patient_id}):\n\n- **DOB:** ${p.dob}\n- **Gender:** ${p.gender}\n- **Phone:** ${p.phone}\n- **Email:** ${p.email || 'N/A'}\n- **Blood Group:** ${p.blood_group || 'N/A'}${appointmentInfo}`
      : `Found **${rows.length}** patients matching "${searchTerm}":`,
    sqlExecuted: sql,
    data: rows,
    tableData: {
      headers: ['Patient ID', 'Name', 'DOB', 'Gender', 'Phone', 'Email', 'Blood Group'],
      rows: rows.map(r => ({
        'Patient ID': r.patient_id,
        'Name': `${r.first_name} ${r.last_name}`,
        'DOB': r.dob,
        'Gender': r.gender,
        'Phone': r.phone,
        'Email': r.email || 'N/A',
        'Blood Group': r.blood_group || 'N/A'
      }))
    },
    stats: [{ label: 'Matches Found', value: rows.length }]
  };
}

// ============================================================================
// 4B. PATIENT CONSULTING DOCTOR & APPOINTMENTS RELATIONSHIP QUERIES
// ============================================================================

async function handlePatientDoctorOrAppointmentQuery(
  nlu: IntentClassificationResult,
  rawMessage: string,
  ctx: ConversationContext,
  workflowState: WorkflowState,
  _history: ChatTurn[]
): Promise<AssistantResponse> {
  const { intent, entities } = nlu;
  const isDoctorQuery = intent === 'patient.doctor_query' || entities.queryFocus === 'doctor';
  const isNextQuery = entities.queryFocus === 'next_appointment' || /\bnext\b/i.test(rawMessage);
  const isFollowUp = entities.isFollowUp || /^(when\s+is\s+it|who\s+is\s+the\s+doctor|which\s+doctor|what\s+time|when\??)/i.test(rawMessage.trim());

  // 1. Resolve Target Patient from entities or short-term context
  let patientTarget = (entities.patientName || '').trim();

  if (!patientTarget) {
    if (workflowState.patientName) {
      patientTarget = workflowState.patientName;
    } else if (ctx.lastPatientName) {
      patientTarget = ctx.lastPatientName;
    } else if (workflowState.patientId) {
      patientTarget = workflowState.patientId;
    } else if (ctx.lastPatientId) {
      patientTarget = ctx.lastPatientId;
    }
  }

  // If still not found, check if message has a name pattern
  if (!patientTarget) {
    const rawMatch = rawMessage.match(/\bpatient\s+([A-Za-z0-9_-]+)/i) ||
                     rawMessage.match(/([A-Za-z0-9_-]+)\s+oda/i) ||
                     rawMessage.match(/([A-Za-z0-9_-]+)'s/i);
    if (rawMatch && !['the', 'doctor', 'patient', 'which', 'what', 'when', 'who'].includes(rawMatch[1].toLowerCase())) {
      patientTarget = rawMatch[1];
    }
  }

  // Follow-up resolution when appointment is already stored in short-term context
  if (isFollowUp && (ctx.lastAppointmentDate || workflowState.appointmentDate)) {
    const patName = ctx.lastPatientName || workflowState.patientName || 'the patient';
    const docName = ctx.lastDoctorName || workflowState.doctorName || 'the doctor';
    const aptDate = ctx.lastAppointmentDate || workflowState.appointmentDate;
    const aptTime = ctx.lastAppointmentTime || workflowState.appointmentTime || 'the scheduled time';
    const aptCode = ctx.lastAppointmentCode || workflowState.lastAppointmentCode || 'on file';

    if (/^(who|which\s+doctor|doctor\s+yaaru)/i.test(rawMessage.trim())) {
      return {
        success: true,
        message: `The consulting doctor for **${patName}**'s appointment (${aptCode}) is **${docName}** (${workflowState.departmentName || 'General Medicine'}).`,
        steps: ['Retrieved doctor details from conversation context']
      };
    }

    return {
      success: true,
      message: `The appointment for **${patName}** with **${docName}** is scheduled for **${aptDate}** at **${aptTime}** (Status: **Confirmed**, Code: **${aptCode}**).`,
      steps: ['Retrieved appointment date and time from conversation context']
    };
  }

  if (!patientTarget) {
    return {
      success: true,
      message: `Which patient would you like to check doctor and appointment details for? (e.g. "Which doctor does Shero consult?" or "Show Shero's appointments")`,
      steps: ['Awaiting patient name for appointment/doctor inquiry']
    };
  }

  // 2. Query PostgreSQL patients table
  const searchPattern = `%${patientTarget.toLowerCase()}%`;
  const patientSql = `
    SELECT id, patient_id, first_name, last_name, dob, gender, phone, email, blood_group
    FROM patients
    WHERE LOWER(first_name) LIKE $1 
       OR LOWER(last_name) LIKE $1 
       OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE $1 
       OR LOWER(patient_id) LIKE $1
    ORDER BY created_at DESC
    LIMIT 5
  `;
  const patRes = await executeSafeReadOnlyQuery(patientSql, [searchPattern]);
  const matchedPatients = patRes.rows || [];

  if (matchedPatients.length === 0) {
    return {
      success: true,
      message: `No patient records found matching "**${patientTarget}**" in the database. Please verify the patient name or Medical Record Number.`,
      sqlExecuted: patientSql,
      data: [],
      steps: [
        `Searching PostgreSQL patients table for "${patientTarget}"...`,
        'No matching patient record found in database'
      ]
    };
  }

  const patient = matchedPatients[0];
  const patientFullName = `${patient.first_name} ${patient.last_name}`.trim();

  // 3. Query PostgreSQL appointments joined with doctors and departments
  const apptSql = `
    SELECT 
      a.id AS appointment_id,
      a.appointment_code,
      a.appointment_date,
      a.appointment_time,
      a.status,
      a.appointment_type,
      a.reason_for_visit,
      a.notes,
      p.id AS patient_db_id,
      p.patient_id AS patient_code,
      p.first_name,
      p.last_name,
      d.id AS doctor_id,
      d.name AS doctor_name,
      COALESCE(dept.name, d.department_name, a.department_name, 'General Medicine') AS department_name,
      d.specialization,
      d.room_number,
      d.experience
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN departments dept ON a.department_id = dept.id
    WHERE a.patient_id = $1
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `;

  const apptRes = await executeSafeReadOnlyQuery(apptSql, [patient.id]);
  const appointments = apptRes.rows || [];

  // Update session context & workflow state with patient info
  ctx.lastPatientId = patient.id;
  ctx.lastPatientName = patientFullName;
  workflowState.patientId = patient.id;
  workflowState.patientName = patientFullName;
  workflowState.patientCode = patient.patient_id;

  // 4. Handle Case: Patient has NO appointments
  if (appointments.length === 0) {
    const activeSymptom = entities.symptoms || workflowState.symptoms || detectSymptomFromText(rawMessage)?.symptomName;
    if (activeSymptom) {
      const match = detectSymptomFromText(activeSymptom);
      const specName = match?.matchedDefinition?.specialtyName || 'Orthopedics';
      return {
        success: true,
        message: `Patient **${patientFullName}** (${patient.patient_id}) has no prior appointments on file.\n\nFor their symptom (**${activeSymptom}**), I recommend consulting **${specName}** (such as **Dr. Rajesh Sharma** in Orthopedics). Would you like me to schedule an appointment for **${patientFullName}**?`,
        sqlExecuted: apptSql,
        data: [],
        steps: [
          `Verified patient: ${patientFullName} (${patient.patient_id})`,
          `No existing appointments found`,
          `Recommended specialty for '${activeSymptom}': ${specName}`
        ]
      };
    }

    if (isDoctorQuery) {
      return {
        success: true,
        message: `Patient **${patientFullName}** (${patient.patient_id}) has no appointment records on file, so no consulting doctor is currently associated.\n\nTo recommend the most suitable doctor, what symptoms or medical reason is **${patientFullName}** consulting for? (e.g. Orthopedics for bone and joint pain, Cardiology for heart health, or General Medicine).`,
        sqlExecuted: apptSql,
        data: [],
        steps: [
          `Verified patient: ${patientFullName} (${patient.patient_id})`,
          'Queried appointments and doctors in PostgreSQL',
          'No prior appointments found; prompted for symptoms'
        ]
      };
    }

    return {
      success: true,
      message: `Patient **${patientFullName}** (${patient.patient_id}) has no appointment records in the database. As there are no appointments on file, no consulting doctor is currently associated.\n\nWould you like me to book an appointment for **${patientFullName}**?`,
      sqlExecuted: apptSql,
      data: [],
      stats: [
        { label: 'Patient MRN', value: patient.patient_id },
        { label: 'Appointments Found', value: 0 }
      ],
      steps: [
        `Verified patient: ${patientFullName} (${patient.patient_id})`,
        'Queried appointments table joined with doctors table...',
        'No appointment records found (zero consulting doctors associated)'
      ]
    };
  }

  // 5. Patient HAS appointments!
  // Save primary appointment details to short-term context and workflowState
  const primaryAppt = appointments[0];
  ctx.lastDoctorName = primaryAppt.doctor_name;
  ctx.lastDoctorId = primaryAppt.doctor_id;
  ctx.lastAppointmentId = primaryAppt.appointment_id;
  ctx.lastAppointmentCode = primaryAppt.appointment_code;
  ctx.lastAppointmentDate = primaryAppt.appointment_date;
  ctx.lastAppointmentTime = primaryAppt.appointment_time;
  ctx.lastAppointments = appointments;

  workflowState.doctorName = primaryAppt.doctor_name;
  workflowState.doctorId = primaryAppt.doctor_id;
  workflowState.departmentName = primaryAppt.department_name;
  workflowState.appointmentDate = primaryAppt.appointment_date;
  workflowState.appointmentTime = primaryAppt.appointment_time;
  workflowState.lastAppointmentId = primaryAppt.appointment_id;
  workflowState.lastAppointmentCode = primaryAppt.appointment_code;
  workflowState.lastAppointmentDate = primaryAppt.appointment_date;
  workflowState.lastAppointmentTime = primaryAppt.appointment_time;
  workflowState.lastAppointmentsSummary = appointments.map(a => ({
    appointmentCode: a.appointment_code,
    doctorName: a.doctor_name || 'N/A',
    departmentName: a.department_name || 'N/A',
    appointmentDate: a.appointment_date,
    appointmentTime: a.appointment_time,
    status: a.status
  }));

  // Unique consulting doctors
  const uniqueDoctors = Array.from(
    new Set(appointments.map(a => a.doctor_name).filter(Boolean))
  );

  let responseMessage = '';

  // 6. Format Response Message
  if (isDoctorQuery) {
    if (appointments.length === 1) {
      const apt = appointments[0];
      responseMessage = `Patient **${patientFullName}** (${patient.patient_id}) consults **${apt.doctor_name}** in the **${apt.department_name}** department.\n\n` +
        `**Appointment Details:**\n` +
        `- **Doctor:** ${apt.doctor_name} (${apt.specialization || apt.department_name})\n` +
        `- **Department:** ${apt.department_name}\n` +
        `- **Appointment Date:** ${apt.appointment_date}\n` +
        `- **Appointment Time:** ${apt.appointment_time}\n` +
        `- **Status:** ${apt.status}\n` +
        `- **Appointment Code:** ${apt.appointment_code}` +
        (apt.reason_for_visit ? `\n- **Reason:** ${apt.reason_for_visit}` : '');
    } else {
      // Multiple appointments: list all relevant appointments and doctors
      responseMessage = `Patient **${patientFullName}** (${patient.patient_id}) consults **${uniqueDoctors.join(', ')}** across **${appointments.length}** appointments on record:\n\n`;
      appointments.forEach((apt, idx) => {
        responseMessage += `**${idx + 1}. Appointment ${apt.appointment_code}**\n`;
        responseMessage += `- **Doctor:** ${apt.doctor_name || 'N/A'} (${apt.specialization || apt.department_name})\n`;
        responseMessage += `- **Department:** ${apt.department_name}\n`;
        responseMessage += `- **Date & Time:** ${apt.appointment_date} at ${apt.appointment_time}\n`;
        responseMessage += `- **Status:** ${apt.status}\n`;
        responseMessage += `- **Type:** ${apt.appointment_type || 'Consultation'}\n\n`;
      });
    }
  } else if (isNextQuery) {
    const nextAppt = appointments[0];
    responseMessage = `The next appointment for **${patientFullName}** (${patient.patient_id}) is with **${nextAppt.doctor_name}** on **${nextAppt.appointment_date}** at **${nextAppt.appointment_time}**.\n\n` +
      `**Appointment Details:**\n` +
      `- **Doctor:** ${nextAppt.doctor_name} (${nextAppt.specialization || nextAppt.department_name})\n` +
      `- **Department:** ${nextAppt.department_name}\n` +
      `- **Date:** ${nextAppt.appointment_date}\n` +
      `- **Time:** ${nextAppt.appointment_time}\n` +
      `- **Status:** ${nextAppt.status}\n` +
      `- **Appointment Code:** ${nextAppt.appointment_code}`;

    if (appointments.length > 1) {
      responseMessage += `\n\n*(Note: Patient has a total of ${appointments.length} appointments on file).*`;
    }
  } else {
    // Show Shero's appointments
    responseMessage = `Found **${appointments.length}** appointment(s) for patient **${patientFullName}** (${patient.patient_id}):\n\n`;
    appointments.forEach((apt, idx) => {
      responseMessage += `**${idx + 1}. ${apt.appointment_code}** — **${apt.doctor_name || 'Physician'}** (${apt.department_name})\n`;
      responseMessage += `- **Date & Time:** ${apt.appointment_date} at ${apt.appointment_time}\n`;
      responseMessage += `- **Status:** ${apt.status}\n`;
      responseMessage += `- **Type:** ${apt.appointment_type || 'Consultation'}\n\n`;
    });
  }

  return {
    success: true,
    message: responseMessage.trim(),
    sqlExecuted: apptSql,
    data: appointments,
    tableData: {
      headers: ['Appointment Code', 'Doctor', 'Department', 'Specialization', 'Date', 'Time', 'Status'],
      rows: appointments.map(r => ({
        'Appointment Code': r.appointment_code,
        'Doctor': r.doctor_name || 'N/A',
        'Department': r.department_name || 'N/A',
        'Specialization': r.specialization || 'N/A',
        'Date': r.appointment_date,
        'Time': r.appointment_time,
        'Status': r.status
      }))
    },
    stats: [
      { label: 'Patient', value: patientFullName },
      { label: 'Consulting Doctor', value: uniqueDoctors[0] || 'N/A' },
      { label: 'Appointments', value: appointments.length }
    ],
    steps: [
      `Found patient record: ${patientFullName} (${patient.patient_id})`,
      'Queried appointments joined with doctors & departments in PostgreSQL...',
      `Retrieved ${appointments.length} appointment record(s) and consulting doctor relationships`
    ]
  };
}

async function handlePatientList(entities: ExtractedEntities): Promise<AssistantResponse> {
  const limit = Math.min(Math.max(entities.limit || 5, 1), 50);
  const sql = `
    SELECT id, patient_id, first_name, last_name, dob, gender, phone, email, blood_group
    FROM patients
    ORDER BY patient_id ASC
    LIMIT ${limit}
  `;
  const res = await executeSafeReadOnlyQuery(sql);
  const rows = res.rows || [];

  return {
    success: true,
    message: `Here are the first **${rows.length}** registered patients from the database:`,
    sqlExecuted: sql,
    data: rows,
    tableData: {
      headers: ['Patient ID', 'Name', 'DOB', 'Gender', 'Phone', 'Email', 'Blood Group'],
      rows: rows.map(r => ({
        'Patient ID': r.patient_id,
        'Name': `${r.first_name} ${r.last_name}`,
        'DOB': r.dob,
        'Gender': r.gender,
        'Phone': r.phone,
        'Email': r.email || 'N/A',
        'Blood Group': r.blood_group || 'N/A'
      }))
    },
    stats: [{ label: 'Patients Listed', value: rows.length }]
  };
}

// ============================================================================
// 5. APPOINTMENT QUERIES (COUNT, LIST)
// ============================================================================

async function handleAppointmentCount(): Promise<AssistantResponse> {
  const sql = `SELECT COUNT(*) as count FROM appointments`;
  const res = await executeSafeReadOnlyQuery(sql);
  const count = Number(res.rows?.[0]?.count ?? 0);

  return {
    success: true,
    message: `There are currently **${count}** appointments in the database.`,
    sqlExecuted: sql,
    stats: [{ label: 'Total Appointments', value: count, trend: 'up' }],
    steps: ['Understanding request...', 'Querying Appointments Database...', 'Preparing response...']
  };
}

async function handleAppointmentList(entities: ExtractedEntities): Promise<AssistantResponse> {
  const limit = Math.min(Math.max(entities.limit || 5, 1), 50);
  const sql = `
    SELECT 
      a.appointment_code, 
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      d.name as doctor_name, 
      COALESCE(dept.name, d.department_name, a.department_name, 'General Medicine') as department_name, 
      a.appointment_date, 
      a.appointment_time, 
      a.status
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN departments dept ON a.department_id = dept.id
    ORDER BY a.appointment_date DESC, a.appointment_time ASC
    LIMIT ${limit}
  `;
  const res = await executeSafeReadOnlyQuery(sql);
  const rows = res.rows || [];

  return {
    success: true,
    message: `Here are the **${rows.length}** appointments ordered chronologically:`,
    sqlExecuted: sql,
    data: rows,
    tableData: {
      headers: ['Code', 'Patient', 'Doctor', 'Department', 'Date', 'Time', 'Status'],
      rows: rows.map(r => ({
        'Code': r.appointment_code,
        'Patient': r.patient_name || 'Patient',
        'Doctor': r.doctor_name || 'Physician',
        'Department': r.department_name || 'General',
        'Date': r.appointment_date,
        'Time': r.appointment_time,
        'Status': r.status
      }))
    },
    stats: [{ label: 'Appointments Shown', value: rows.length }]
  };
}

// ============================================================================
// 6. CLAIMS & DENIALS QUERIES
// ============================================================================

async function handleClaimList(entities: ExtractedEntities): Promise<AssistantResponse> {
  const status = (entities.claimStatus || 'pending').toLowerCase();

  let sql: string;
  if (status.includes('unpaid')) {
    sql = `
      SELECT 
        claim_id, 
        patient_name, 
        insurance_provider, 
        claim_amount, 
        final_payment_status, 
        outstanding_amount,
        days_since_claim_submission
      FROM claims 
      WHERE LOWER(final_payment_status) = 'unpaid' OR outstanding_amount > 0
      ORDER BY outstanding_amount DESC 
      LIMIT 15
    `;
  } else {
    sql = `
      SELECT 
        claim_id, 
        patient_name, 
        insurance_provider, 
        claim_amount, 
        claim_status, 
        days_since_claim_submission
      FROM claims 
      WHERE LOWER(claim_status) IN ('pending', 'submitted', 'in review', 'draft')
      ORDER BY days_since_claim_submission DESC, claim_amount DESC 
      LIMIT 15
    `;
  }

  const res = await executeSafeReadOnlyQuery(sql);
  const rows = res.rows || [];

  return {
    success: true,
    message: status.includes('unpaid')
      ? `I found **${rows.length}** unpaid claims in the database:`
      : `I found **${rows.length}** pending claims awaiting payer adjudication:`,
    sqlExecuted: sql,
    data: rows,
    tableData: {
      headers: ['Claim ID', 'Patient', 'Payer', 'Amount', 'Status', 'Days Pending'],
      rows: rows.map(r => ({
        'Claim ID': r.claim_id,
        'Patient': r.patient_name,
        'Payer': r.insurance_provider,
        'Amount': `$${Number(r.claim_amount).toLocaleString()}`,
        'Status': r.claim_status || r.final_payment_status,
        'Days Pending': `${r.days_since_claim_submission || 0} days`
      }))
    },
    stats: [{ label: status.includes('unpaid') ? 'Unpaid Claims' : 'Pending Claims', value: rows.length }]
  };
}

async function handleClaimCount(): Promise<AssistantResponse> {
  const sql = `SELECT COUNT(*) as count FROM claims WHERE LOWER(claim_status) IN ('pending', 'submitted', 'in review', 'draft')`;
  const res = await executeSafeReadOnlyQuery(sql);
  const count = Number(res.rows?.[0]?.count ?? 0);

  return {
    success: true,
    message: `There are currently **${count}** pending claims awaiting processing.`,
    sqlExecuted: sql,
    stats: [{ label: 'Pending Claims', value: count }]
  };
}

async function handleDenialCount(): Promise<AssistantResponse> {
  // Query denials table
  let sql = `SELECT COUNT(*) as count FROM denials`;
  let res = await executeSafeReadOnlyQuery(sql);
  let count = Number(res.rows?.[0]?.count ?? 0);

  if (count === 0) {
    sql = `SELECT COUNT(*) as count FROM claims WHERE LOWER(claim_status) = 'denied'`;
    res = await executeSafeReadOnlyQuery(sql);
    count = Number(res.rows?.[0]?.count ?? 0);
  }

  return {
    success: true,
    message: `There are currently **${count}** claim denials recorded in the system.`,
    sqlExecuted: sql,
    stats: [{ label: 'Claim Denials', value: count, trend: 'down' }]
  };
}

async function handleDenialList(): Promise<AssistantResponse> {
  const sql = `
    SELECT 
      d.denial_code, 
      d.denial_reason, 
      d.denial_amount, 
      d.denial_status, 
      c.claim_id, 
      c.patient_name, 
      c.insurance_provider
    FROM denials d
    LEFT JOIN claims c ON d.claim_id = c.claim_id
    ORDER BY d.denial_amount DESC 
    LIMIT 15
  `;
  const res = await executeSafeReadOnlyQuery(sql);
  const rows = res.rows || [];

  return {
    success: true,
    message: `Found **${rows.length}** denied claim records with denial reasons:`,
    sqlExecuted: sql,
    data: rows,
    tableData: {
      headers: ['Claim ID', 'Patient', 'Payer', 'Code', 'Reason', 'Denied Amount'],
      rows: rows.map(r => ({
        'Claim ID': r.claim_id || 'N/A',
        'Patient': r.patient_name || 'N/A',
        'Payer': r.insurance_provider || 'N/A',
        'Code': r.denial_code,
        'Reason': r.denial_reason,
        'Denied Amount': `$${Number(r.denial_amount || 0).toLocaleString()}`
      }))
    },
    stats: [{ label: 'Denials Listed', value: rows.length }]
  };
}

// ============================================================================
// 7. PAYMENTS & REMITTANCE QUERIES
// ============================================================================

async function handlePaymentSummary(): Promise<AssistantResponse> {
  const sql = `
    SELECT 
      COALESCE(SUM(amount), 0) as total_received,
      COUNT(*) as payment_count
    FROM payments 
    WHERE LOWER(status) = 'completed'
  `;
  const res = await executeSafeReadOnlyQuery(sql);
  const row = res.rows?.[0] || { total_received: 0, payment_count: 0 };
  const total = Number(row.total_received);
  const count = Number(row.payment_count);

  // Grab recent payments for tableData
  const listSql = `
    SELECT id, claim_id, payer, amount, payment_type, payment_date, status, reference_number
    FROM payments
    ORDER BY payment_date DESC
    LIMIT 8
  `;
  const listRes = await executeSafeReadOnlyQuery(listSql);
  const recent = listRes.rows || [];

  return {
    success: true,
    message: `Total revenue collected and received to date is **$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** across **${count}** completed remittance payments.`,
    sqlExecuted: sql,
    tableData: {
      headers: ['Reference #', 'Claim ID', 'Payer', 'Amount', 'Payment Type', 'Date'],
      rows: recent.map(r => ({
        'Reference #': r.reference_number || r.id,
        'Claim ID': r.claim_id,
        'Payer': r.payer,
        'Amount': `$${Number(r.amount).toLocaleString()}`,
        'Payment Type': r.payment_type,
        'Date': r.payment_date
      }))
    },
    stats: [
      { label: 'Total Revenue Received', value: `$${total.toLocaleString()}`, trend: 'up' },
      { label: 'Completed Payments', value: count }
    ]
  };
}

async function handlePaymentList(): Promise<AssistantResponse> {
  const sql = `
    SELECT id, claim_id, payer, amount, payment_type, payment_date, status, reference_number
    FROM payments
    ORDER BY payment_date DESC
    LIMIT 15
  `;
  const res = await executeSafeReadOnlyQuery(sql);
  const rows = res.rows || [];

  return {
    success: true,
    message: `Here are the latest **${rows.length}** payment transactions from the database:`,
    sqlExecuted: sql,
    data: rows,
    tableData: {
      headers: ['Reference #', 'Claim ID', 'Payer', 'Amount', 'Payment Type', 'Date'],
      rows: rows.map(r => ({
        'Reference #': r.reference_number || r.id,
        'Claim ID': r.claim_id,
        'Payer': r.payer,
        'Amount': `$${Number(r.amount).toLocaleString()}`,
        'Payment Type': r.payment_type,
        'Date': r.payment_date
      }))
    },
    stats: [{ label: 'Payments Displayed', value: rows.length }]
  };
}

// ============================================================================
// 8. GENERAL & AD-HOC RCM SQL QUERIES (LANGCHAIN SQL AGENT)
// ============================================================================

async function handleSqlQuery(
  queryText: string,
  history: ChatTurn[]
): Promise<AssistantResponse> {
  try {
    const langChainResult = await generateAndExecuteSqlWithLangChain(queryText, history);
    if (langChainResult && langChainResult.success && Array.isArray(langChainResult.rows)) {
      const rows = langChainResult.rows;

      if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
        const key = Object.keys(rows[0])[0];
        const val = rows[0][key];
        return {
          success: true,
          message: langChainResult.summary || `Query result: **${val}**`,
          sqlExecuted: langChainResult.sql,
          stats: [{ label: key.replace(/_/g, ' ').toUpperCase(), value: val }],
          steps: ['Understanding request...', 'Generating SQL with Groq LLM...', 'Querying PostgreSQL...', 'Synthesizing response...']
        };
      }

      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        return {
          success: true,
          message: langChainResult.summary || `I found **${rows.length}** records matching your request:`,
          sqlExecuted: langChainResult.sql,
          data: rows,
          tableData: {
            headers,
            rows
          },
          stats: [{ label: 'Records Found', value: rows.length }],
          steps: ['Understanding request...', 'Generating SQL with Groq LLM...', 'Querying PostgreSQL...', 'Synthesizing response...']
        };
      }

      return {
        success: true,
        message: langChainResult.summary || `No records found in the database matching your query.`,
        sqlExecuted: langChainResult.sql,
        data: [],
        stats: [{ label: 'Records Found', value: 0 }],
        steps: ['Understanding request...', 'Generating SQL with Groq LLM...', 'Querying PostgreSQL...', 'Synthesizing response...']
      };
    }
  } catch (err: any) {
    console.warn('[Assistant] LangChain SQL query error:', err?.message);
  }

  return {
    success: false,
    message: "I couldn't find relevant records in the RCM database for that question. You can ask about patients, appointments, claims, denials, or payments.",
    steps: ['Evaluating RCM data...', 'No matching records found']
  };
}

// ============================================================================
// CONFIRMED ACTION EXECUTION
// ============================================================================

async function executeConfirmedAction(
  action: { type: string; payload: any },
  ctx: ConversationContext,
  workflowState?: WorkflowState
): Promise<AssistantResponse> {
  try {
    switch (action.type) {
      case 'create_patient': {
        const patient = await executeCreatePatient(action.payload);
        if (!patient) {
          throw new Error('Failed to register patient in PostgreSQL database.');
        }
        ctx.lastPatientId = patient.id;
        ctx.lastPatientName = `${patient.first_name} ${patient.last_name}`.trim();

        if (workflowState) {
          workflowState.patientId = patient.id;
          workflowState.patientCode = patient.patient_id;
          workflowState.patientName = `${patient.first_name} ${patient.last_name}`.trim();
          workflowState.registrationDraft = null;
          workflowState.pendingAction = null;
          ctx.pendingConfirmationPayload = null;

          // If in-progress appointment booking details exist, continue booking workflow
          if (workflowState.appointmentDate && workflowState.appointmentTime) {
            const doctorObj = await resolveDoctor(workflowState.doctorName, workflowState.departmentName);
            workflowState.doctorId = doctorObj.id;
            workflowState.doctorName = doctorObj.name;
            workflowState.departmentName = doctorObj.department_name;
            ctx.lastDoctorId = doctorObj.id;
            ctx.lastDoctorName = doctorObj.name;

            const aptPayload = {
              patientId: patient.id,
              patientName: workflowState.patientName,
              patientCode: patient.patient_id,
              doctorId: doctorObj.id,
              doctorName: doctorObj.name,
              departmentId: doctorObj.department_id || null,
              departmentName: doctorObj.department_name || 'General Medicine',
              appointmentDate: workflowState.appointmentDate,
              appointmentTime: workflowState.appointmentTime,
              appointmentType: 'Consultation',
              reasonForVisit: workflowState.reasonForVisit || 'Consultation'
            };

            workflowState.activeIntent = 'appointment.create';
            workflowState.workflowStatus = 'awaiting_appointment_confirmation';
            workflowState.pendingAction = {
              type: 'create_appointment',
              payload: aptPayload
            };
            ctx.pendingConfirmationPayload = aptPayload;

            return {
              success: true,
              message: `Patient **${patient.first_name} ${patient.last_name}** has been successfully registered with Medical Record Number **${patient.patient_id}**!\n\nContinuing with your appointment booking:\n\n**Appointment Summary:**\n- **Patient:** ${aptPayload.patientName} (${patient.patient_id})\n- **Doctor:** ${aptPayload.doctorName} (${aptPayload.departmentName})\n- **Date:** ${aptPayload.appointmentDate}\n- **Time:** ${aptPayload.appointmentTime}\n- **Reason for Visit:** ${aptPayload.reasonForVisit}\n\nWould you like me to book this appointment in the system?`,
              requiresConfirmation: true,
              action: {
                type: 'create_appointment',
                payload: aptPayload
              },
              steps: [
                'Patient saved to PostgreSQL database',
                'Medical Record Number generated',
                'Resumed appointment booking workflow',
                'Awaiting appointment confirmation...'
              ]
            };
          }
        }

        return {
          success: true,
          message: `Patient **${patient.first_name} ${patient.last_name}** has been successfully registered with Medical Record Number **${patient.patient_id}**.`,
          data: patient,
          action: {
            type: 'patient_created',
            payload: patient
          },
          steps: ['Registering Patient in PostgreSQL...', 'Patient Profile Created in Database!']
        };
      }

      case 'create_appointment': {
        const apt = await executeCreateAppointment(action.payload);
        if (!apt) {
          throw new Error('Failed to create appointment in PostgreSQL database.');
        }
        ctx.lastPatientId = apt.patient_id;
        ctx.lastPatientName = `${apt.first_name || ''} ${apt.last_name || ''}`.trim();
        ctx.lastDoctorId = apt.doctor_id;
        ctx.lastDoctorName = apt.doctor_name;

        if (workflowState) {
          workflowState.workflowStatus = 'completed';
          workflowState.pendingAction = null;
        }
        ctx.pendingConfirmationPayload = null;

        const reasonDisplay = apt.reason_for_visit ? `\nReason for consultation: **${apt.reason_for_visit}**.` : '';
        return {
          success: true,
          message: `Appointment successfully booked for **${action.payload.patientName}** with **${action.payload.doctorName}** on ${apt.appointment_date} at ${apt.appointment_time}.\n\nAppointment code: **${apt.appointment_code}**.${reasonDisplay}`,
          data: apt,
          action: {
            type: 'appointment_created',
            payload: apt
          },
          steps: ['Executing Appointment Creation...', 'Saving to PostgreSQL database...', 'Confirmed!']
        };
      }

      case 'create_claim': {
        const claim = await executeCreateClaim(action.payload);
        ctx.lastClaimId = claim.claim_id;
        return {
          success: true,
          message: `Claim **${claim.claim_id}** for $${Number(claim.claim_amount).toLocaleString()} has been successfully created and submitted to ${claim.insurance_provider}.`,
          data: claim,
          steps: ['Creating Claim in Claims Engine...', 'Claim Submitted!']
        };
      }

      case 'update_claim_status': {
        const claim = await executeUpdateClaimStatus(action.payload.claimId, action.payload.status);
        return {
          success: true,
          message: `Claim **${claim.claim_id}** status updated to '${claim.claim_status}'.`,
          data: claim,
          steps: ['Updating Claim Record in PostgreSQL...', 'Claim Status Updated!']
        };
      }

      case 'record_payment': {
        const payment = await executeRecordPayment(action.payload);
        return {
          success: true,
          message: `Payment of **$${Number(payment.amount).toLocaleString()}** from ${payment.payer} has been recorded successfully with reference #${payment.reference_number}.`,
          data: payment,
          steps: ['Recording Remittance in PostgreSQL...', 'Payment Completed!']
        };
      }

      default:
        return {
          success: false,
          message: `Unknown action type: ${action.type}`
        };
    }
  } catch (err: any) {
    console.error('[Assistant] Error executing confirmed action:', err);
    return {
      success: false,
      message: `Failed to execute action: ${err?.message || 'Database error occurred.'}`
    };
  }
}
