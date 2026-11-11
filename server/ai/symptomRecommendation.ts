import { query } from '../db.ts';

// ============================================================================
// CLINICAL SYMPTOM & SPECIALTY RECOMMENDATION ENGINE
// ============================================================================

export interface SpecialtyDefinition {
  specialtyName: string;
  departmentSearchTerms: string[];
  doctorSearchTerms: string[];
  keywords: string[];
  guidanceNote: string;
  clarifyingQuestions?: string[];
  urgentWarning: string;
  isHospitalSupported?: boolean;
  alternativeDepartment?: string;
  alternativeExplanation?: string;
}

export interface DoctorSlotInfo {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string;
  specialization: string;
  roomNumber: string;
  experience: string;
  workingHours: { start: string; end: string };
  availableSlots: string[];
}

export interface SymptomRecommendationResult {
  detectedSymptom: string;
  specialtyName: string;
  guidanceNote: string;
  urgentWarning: string;
  isHospitalSupported: boolean;
  alternativeExplanation?: string;
  department: any | null;
  doctors: DoctorSlotInfo[];
  alternatives?: DoctorSlotInfo[];
  formattedRecommendationMessage: string;
}

// ----------------------------------------------------------------------------
// SYMPTOM TO SPECIALTY KNOWLEDGE BASE
// Covers formal, informal, colloquial, typos, and Thanglish expressions.
// ----------------------------------------------------------------------------
export const SYMPTOM_SPECIALTY_MAP: SpecialtyDefinition[] = [
  {
    specialtyName: 'Orthopedics',
    departmentSearchTerms: ['orthopedics', 'orthopedic', 'ortho'],
    doctorSearchTerms: ['orthopedics', 'joint replacement', 'spine surgery', 'spine', 'sports medicine', 'arthroscopy', 'bone', 'musculoskeletal'],
    keywords: [
      // Neck pain & variations
      'neck pain', 'nek pain', 'neck paining', 'pain in neck', 'stiff neck', 'neck stiffness',
      'cervical pain', 'cervical spondylosis', 'neck ache', 'sore neck', 'neck strain',
      'kazhuthu vali', 'kazhuthu valikidhu', 'kazhuthula vali', 'kazhuthu novu',
      // Joint & musculoskeletal
      'joint pain', 'joints pain', 'joint ache', 'knee pain', 'knees hurting', 'knee ache',
      'back pain', 'lower back pain', 'backache', 'spine pain', 'shoulder pain', 'hip pain',
      'bone fracture', 'sprain', 'arthritis', 'osteoarthritis', 'swollen joint', 'elbow pain',
      'ankle pain', 'wrist pain', 'ligament tear', 'slip disc', 'sciatica', 'spondylitis',
      // Thanglish musculoskeletal
      'moottu vali', 'kaal vali', 'kai vali', 'iduppu vali', 'thol vali', 'mutti vali',
      'kaal valikkuthu', 'kai valikkuthu', 'iduppu valikuthu'
    ],
    guidanceNote:
      'For neck and musculoskeletal symptoms, **Orthopedics** (specializing in joint, spine, and musculoskeletal care) is the most suitable department. Consider **Physical Medicine & Rehabilitation (PM&R)** or clinical physiotherapy if available for non-surgical rehabilitation.',
    clarifyingQuestions: [
      'How long have you been experiencing the neck or joint pain?',
      'Does the pain radiate down into your shoulders, arms, or fingers?'
    ],
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** If you experience severe red-flag symptoms — such as sudden severe numbness, shooting pain radiating down both arms, sudden hand/arm weakness, difficulty balancing or walking, or loss of bowel/bladder control — please seek emergency medical evaluation immediately.'
  },
  {
    specialtyName: 'Dermatology',
    departmentSearchTerms: ['dermatology', 'derm'],
    doctorSearchTerms: ['dermatology', 'skin', 'biopsy'],
    keywords: [
      'skin rash', 'rash', 'rashes', 'skin allergy', 'itching', 'itchy skin',
      'pimples', 'acne', 'eczema', 'psoriasis', 'skin peeling', 'hives', 'urticaria',
      'skin infection', 'boils', 'red spots on skin', 'dry skin patch', 'dermatitis',
      'fungal infection', 'ringworm', 'skin burning',
      // Thanglish
      'aripu', 'arippu', 'tholu allergy', 'thol arichal', 'skin arichal', 'thadipu', 'thadippu'
    ],
    guidanceNote:
      'For skin irritations, rashes, and dermatological conditions, **Dermatology** is the recommended specialty for clinical evaluation and skin care.',
    clarifyingQuestions: [
      'Is the rash accompanied by blistering, swelling, or fever?',
      'Has the rash spread rapidly or come into contact with a known allergen?'
    ],
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** If the rash is accompanied by facial/throat swelling, difficulty breathing, high fever, or widespread blistering/peeling skin, seek immediate emergency medical care.'
  },
  {
    specialtyName: 'Dentistry',
    departmentSearchTerms: ['dentistry', 'dental', 'teeth'],
    doctorSearchTerms: ['dentist', 'dental', 'dentistry', 'oral'],
    keywords: [
      'tooth pain', 'tooth ache', 'toothache', 'teeth pain', 'teeth ache',
      'bleeding gums', 'cavity', 'swollen gum', 'wisdom tooth', 'gum infection',
      'jaw pain near tooth', 'sensitive teeth', 'broken tooth',
      // Thanglish
      'pal vali', 'pal valikidhu', 'palla vali', 'eera vali'
    ],
    guidanceNote:
      'For toothache, gum swelling, and oral concerns, **Dentistry** is the appropriate dental specialty.',
    isHospitalSupported: false,
    alternativeDepartment: 'General Medicine',
    alternativeExplanation:
      'Our hospital database currently does not have an active **Dentistry** department. Our **General Medicine** physicians can provide an initial evaluation, prescribe pain management, or treat secondary infections. We also recommend scheduling with an accredited external dental clinic for comprehensive dental procedures.',
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** If dental pain is accompanied by swelling spreading to the eye or neck, high fever, or difficulty swallowing or breathing, seek emergency medical care immediately.'
  },
  {
    specialtyName: 'Ophthalmology',
    departmentSearchTerms: ['ophthalmology', 'eye', 'ophthalmic'],
    doctorSearchTerms: ['ophthalmologist', 'eye', 'vision'],
    keywords: [
      'eye problems', 'eye problem', 'eye pain', 'blurry vision', 'blurred vision',
      'cataract', 'red eyes', 'watery eyes', 'vision loss', 'burning eyes', 'dry eyes',
      'double vision', 'eye discharge', 'eye infection', 'swollen eyelid',
      // Thanglish
      'kannu vali', 'kannu problem', 'paarvai theriyala', 'kann erichal', 'kannula vali'
    ],
    guidanceNote:
      'For vision changes, eye irritation, or eye conditions, **Ophthalmology** is the recommended medical specialty.',
    isHospitalSupported: false,
    alternativeDepartment: 'General Medicine',
    alternativeExplanation:
      'Our hospital currently does not have a dedicated **Ophthalmology** department on file. Our **General Medicine** physicians can assist with initial triage, check for systemic causes, and facilitate urgent external specialist referrals.',
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** If you experience sudden vision loss, severe eye pain with vomiting, flashes of light, or trauma to the eye, seek emergency ophthalmic care immediately.'
  },
  {
    specialtyName: 'Cardiology',
    departmentSearchTerms: ['cardiology', 'cardio', 'heart'],
    doctorSearchTerms: ['cardiology', 'cardiovascular', 'electrophysiology', 'heart'],
    keywords: [
      'heart pain', 'chest pain', 'chest tightness', 'chest pressure', 'chest discomfort',
      'palpitations', 'rapid heartbeat', 'irregular heartbeat', 'shortness of breath',
      'breathlessness', 'angina', 'fluttering heart', 'heart racing', 'swollen feet heart',
      // Thanglish
      'nenju vali', 'nenjula vali', 'idhayathula vali', 'moochu thinaral', 'nenju erichal'
    ],
    guidanceNote:
      'For chest discomfort, palpitations, or cardiovascular concerns, **Cardiology** is the specialized department for heart and hemodynamic assessment.',
    clarifyingQuestions: [
      'Is the chest discomfort radiating to your left arm, neck, jaw, or back?',
      'Does it worsen with physical exertion or is it accompanied by cold sweats?'
    ],
    urgentWarning:
      '🚨 **EMERGENCY WARNING:** Chest pain, severe chest pressure, radiating pain to the left arm/jaw, or sudden shortness of breath can indicate an acute myocardial infarction (heart attack). If you are experiencing these symptoms, please call emergency services (e.g. 911 or local emergency number) or go to the nearest Emergency Room immediately!'
  },
  {
    specialtyName: 'Neurology',
    departmentSearchTerms: ['neurology', 'neuro', 'brain'],
    doctorSearchTerms: ['neurology', 'epilepsy', 'stroke', 'cognitive neurology'],
    keywords: [
      'headache', 'head ache', 'migraine', 'severe head pain', 'dizziness', 'vertigo',
      'seizures', 'fits', 'numbness', 'tingling', 'pins and needles', 'stroke symptoms',
      'facial drooping', 'memory loss', 'tremors', 'shaking hands', 'fainting',
      // Thanglish
      'thala vali', 'thala valikuthu', 'mayakkam', 'thala suthal'
    ],
    guidanceNote:
      'For persistent headaches, migraines, nerve symptoms, or dizziness, **Neurology** is the specialized clinical department.',
    clarifyingQuestions: [
      'Did the headache come on suddenly like a thunderclap?',
      'Have you noticed any weakness on one side of your face or body?'
    ],
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** If you notice sudden facial drooping, one-sided weakness, slurred speech (FAST stroke signs), or the worst headache of your life, seek emergency medical care immediately.'
  },
  {
    specialtyName: 'ENT & Otolaryngology',
    departmentSearchTerms: ['ent', 'otolaryngology', 'ear', 'nose', 'throat'],
    doctorSearchTerms: ['ent', 'sinus', 'otology', 'head & neck'],
    keywords: [
      'ear pain', 'ear ache', 'hearing loss', 'throat pain', 'sore throat',
      'tonsils', 'tonsillitis', 'sinus', 'sinusitis', 'sinus pain', 'blocked nose',
      'nasal congestion', 'ringing in ear', 'tinnitus', 'ear discharge', 'hoarse voice',
      'difficulty swallowing',
      // Thanglish
      'kaadhu vali', 'kaadhu kekala', 'thondai vali', 'thondai valikkuthu', 'mooku adaipu'
    ],
    guidanceNote:
      'For ear, sinus, nasal, and throat conditions, **ENT & Otolaryngology** is the recommended specialty.',
    clarifyingQuestions: [
      'How long have you had the throat or ear symptoms?',
      'Are you experiencing high fever or difficulty opening your mouth?'
    ],
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** If you experience severe difficulty swallowing, airway obstruction, or high fever with neck stiffness, seek emergency medical attention.'
  },
  {
    specialtyName: 'Pediatrics',
    departmentSearchTerms: ['pediatrics', 'ped', 'pediatric'],
    doctorSearchTerms: ['pediatric', 'pediatrics', 'neonatology', 'child'],
    keywords: [
      'child fever', 'baby cough', 'kid illness', 'infant vomiting', 'child checkup',
      'pediatrician', 'baby illness', 'toddler fever', 'child vaccination',
      // Thanglish
      'kuzhandhai kaichal', 'paapa vali', 'chinna pullaiku', 'kuzhandhai'
    ],
    guidanceNote:
      'For infants, children, and adolescents, **Pediatrics** is the specialized clinical department.',
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** For young infants with high fever, lethargy, poor feeding, or rapid breathing, seek immediate emergency pediatric care.'
  },
  {
    specialtyName: 'Oncology',
    departmentSearchTerms: ['oncology', 'cancer', 'tumor'],
    doctorSearchTerms: ['oncology', 'hematology', 'surgical oncology'],
    keywords: [
      'cancer consultation', 'tumor', 'tumour', 'chemotherapy', 'unexplained lump',
      'oncology follow up', 'biopsy follow up cancer', 'abnormal growth'
    ],
    guidanceNote:
      'For oncology surveillance, tumor evaluations, and cancer consultations, **Oncology** is the appropriate clinical department.',
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** For severe intractable pain, acute bleeding, or sudden neurological deficits, seek immediate emergency medical care.'
  },
  {
    specialtyName: 'General Medicine',
    departmentSearchTerms: ['general medicine', 'general', 'internal medicine'],
    doctorSearchTerms: ['internal medicine', 'preventive care', 'general medicine', 'family medicine', 'geriatric'],
    keywords: [
      'general illness', 'fever', 'fevar', 'cold', 'cough', 'flu', 'body pain', 'body ache',
      'fatigue', 'weakness', 'vomiting', 'stomach ache', 'stomach pain', 'nausea', 'head cold',
      'regular checkup', 'health checkup', 'viral fever', 'tiredness', 'routine consultation',
      'not feeling well', 'unwell', 'routine checkup', 'annual physical', 'high blood pressure check',
      'diabetes check', 'general consultation', 'infection', 'food poisoning', 'indigestion',
      // Thanglish
      'kaichal', 'sali', 'irumal', 'udambu vali', 'udambu mudiyala', 'udambu sariyilla', 'vayithu vali'
    ],
    guidanceNote:
      'For primary care, viral illness, general symptoms, and initial diagnostic evaluations, **General Medicine** (Internal Medicine) is the ideal department.',
    clarifyingQuestions: [
      'How many days have you had these symptoms?',
      'Are you experiencing high fever, chills, or dehydration?'
    ],
    urgentWarning:
      '⚠️ **Urgent Warning Signs:** If high fever is accompanied by confusion, severe dehydration, or persistent vomiting, seek urgent medical assessment.'
  }
];

// ----------------------------------------------------------------------------
// HELPER: Normalize time strings and calculate slots
// ----------------------------------------------------------------------------
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes: number): string {
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';

  if (hours > 12) {
    hours -= 12;
  } else if (hours === 0) {
    hours = 12;
  }

  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hoursStr}:${minutesStr} ${period}`;
}

export function generateDoctorTimeSlots(startStr: string, endStr: string, intervalMinutes: number = 30): string[] {
  const startMinutes = parseTimeToMinutes(startStr);
  const endMinutes = parseTimeToMinutes(endStr);
  if (startMinutes >= endMinutes) return ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM'];

  const slots: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += intervalMinutes) {
    slots.push(formatMinutesToTime(m));
  }
  return slots;
}

// ----------------------------------------------------------------------------
// SYMPTOM DETECTION
// ----------------------------------------------------------------------------
export function detectSymptomFromText(text: string): {
  symptomName: string;
  matchedDefinition: SpecialtyDefinition;
} | null {
  if (!text || !text.trim()) return null;
  const lower = text.toLowerCase().trim();

  // Clean conversational prefixes: e.g. "for neck pain", "i have neck pain", "consult for..."
  const cleaned = lower
    .replace(/^(for|i have|having|got|feeling|suffering from|consult for|need doctor for|because of|with)\s+/i, '')
    .trim();

  // 1. Direct or partial keyword match in defined specialty mappings
  for (const def of SYMPTOM_SPECIALTY_MAP) {
    for (const kw of def.keywords) {
      const kwLower = kw.toLowerCase();
      // Match exact or word boundary or substring
      if (lower.includes(kwLower) || cleaned.includes(kwLower)) {
        return {
          symptomName: kw,
          matchedDefinition: def
        };
      }
    }
  }

  // 2. Generic regex fallbacks for pain or ache:
  const painMatch = lower.match(/\b([a-z]+)\s+(?:pain|paining|ache|hurting|problem|issue)\b/i);
  if (painMatch) {
    const organ = painMatch[1].toLowerCase();
    if (['neck', 'throat', 'cervical'].includes(organ)) {
      return {
        symptomName: `${organ} pain`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[0] // Orthopedics
      };
    }
    if (['knee', 'joint', 'joints', 'back', 'spine', 'shoulder', 'leg', 'hand', 'bone', 'elbow', 'hip'].includes(organ)) {
      return {
        symptomName: `${organ} pain`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[0] // Orthopedics
      };
    }
    if (['tooth', 'teeth', 'gum', 'dental'].includes(organ)) {
      return {
        symptomName: `${organ} pain`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[2] // Dentistry
      };
    }
    if (['eye', 'eyes', 'vision'].includes(organ)) {
      return {
        symptomName: `${organ} problem`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[3] // Ophthalmology
      };
    }
    if (['chest', 'heart'].includes(organ)) {
      return {
        symptomName: `${organ} pain`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[4] // Cardiology
      };
    }
    if (['head', 'migraine'].includes(organ)) {
      return {
        symptomName: `${organ} ache`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[5] // Neurology
      };
    }
    if (['ear', 'throat'].includes(organ)) {
      return {
        symptomName: `${organ} pain`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[6] // ENT
      };
    }
    if (['stomach', 'belly', 'abdomen', 'body'].includes(organ)) {
      return {
        symptomName: `${organ} pain`,
        matchedDefinition: SYMPTOM_SPECIALTY_MAP[9] // General Medicine
      };
    }
  }

  return null;
}

// ----------------------------------------------------------------------------
// QUERY MATCHING DOCTORS AND DEPARTMENTS FROM POSTGRESQL
// ----------------------------------------------------------------------------
export async function querySpecialtyDoctorsAndDepartments(
  specialtyDef: SpecialtyDefinition,
  targetDate?: string | null
): Promise<{
  department: any | null;
  doctors: DoctorSlotInfo[];
  alternatives?: DoctorSlotInfo[];
}> {
  // 1. Check if department exists in departments table
  let deptRow: any = null;
  for (const dTerm of specialtyDef.departmentSearchTerms) {
    const dRes = await query(
      `SELECT * FROM departments WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1 LIMIT 1`,
      [`%${dTerm}%`]
    );
    if (dRes.rows.length > 0) {
      deptRow = dRes.rows[0];
      break;
    }
  }

  // 2. Query matching doctors from PostgreSQL doctors table
  let doctorRows: any[] = [];
  if (deptRow) {
    const docRes = await query(
      `SELECT * FROM doctors WHERE department_id = $1 OR LOWER(department_name) LIKE $2 ORDER BY name ASC`,
      [deptRow.id, `%${deptRow.name.toLowerCase()}%`]
    );
    doctorRows = docRes.rows;
  } else {
    // Search doctors by specialization keywords
    for (const sTerm of specialtyDef.doctorSearchTerms) {
      const docRes = await query(
        `SELECT * FROM doctors WHERE LOWER(specialization) LIKE $1 OR LOWER(department_name) LIKE $1 ORDER BY name ASC`,
        [`%${sTerm}%`]
      );
      if (docRes.rows.length > 0) {
        doctorRows = docRes.rows;
        break;
      }
    }
  }

  // 3. If no doctors found and specialty is not supported (e.g. Dentistry, Ophthalmology), fetch General Medicine as alternative
  let alternativeDocs: DoctorSlotInfo[] = [];
  if (doctorRows.length === 0 && specialtyDef.alternativeDepartment) {
    const altRes = await query(
      `SELECT * FROM doctors WHERE LOWER(department_name) LIKE $1 ORDER BY name ASC`,
      [`%${specialtyDef.alternativeDepartment.toLowerCase()}%`]
    );
    alternativeDocs = await mapDoctorRowsToSlotInfo(altRes.rows, targetDate);
  }

  const mappedDoctors = await mapDoctorRowsToSlotInfo(doctorRows, targetDate);

  return {
    department: deptRow,
    doctors: mappedDoctors,
    alternatives: alternativeDocs
  };
}

async function mapDoctorRowsToSlotInfo(rows: any[], targetDate?: string | null): Promise<DoctorSlotInfo[]> {
  const result: DoctorSlotInfo[] = [];

  for (const doc of rows) {
    const hours = typeof doc.working_hours === 'object' && doc.working_hours !== null
      ? doc.working_hours
      : { start: '09:00 AM', end: '05:00 PM' };

    const start = hours.start || '09:00 AM';
    const end = hours.end || '05:00 PM';
    const allSlots = generateDoctorTimeSlots(start, end, 30);

    // If targetDate is specified, query booked appointments to filter out booked slots
    let availableSlots = allSlots;
    if (targetDate) {
      try {
        const bookedRes = await query(
          `SELECT appointment_time FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'Cancelled'`,
          [doc.id, targetDate]
        );
        const bookedSet = new Set(bookedRes.rows.map((r: any) => (r.appointment_time || '').trim().toUpperCase()));
        availableSlots = allSlots.filter((slot) => !bookedSet.has(slot.toUpperCase()));
      } catch (err: any) {
        console.warn(`[SymptomEngine] Slot query error for doctor ${doc.id}:`, err?.message);
      }
    }

    result.push({
      id: doc.id,
      name: doc.name,
      departmentId: doc.department_id || null,
      departmentName: doc.department_name || '',
      specialization: doc.specialization || '',
      roomNumber: doc.room_number || 'Main Clinic',
      experience: doc.experience || '10+ Years',
      workingHours: { start, end },
      availableSlots
    });
  }

  return result;
}

// ----------------------------------------------------------------------------
// FORMAT RECOMMENDATION MESSAGE WITH CLINICAL GUIDANCE & REAL DOCTORS
// ----------------------------------------------------------------------------
export async function buildSymptomRecommendationResponse(
  symptomText: string,
  patientName?: string | null,
  targetDate?: string | null,
  targetTime?: string | null
): Promise<SymptomRecommendationResult> {
  const detection = detectSymptomFromText(symptomText) || {
    symptomName: symptomText,
    matchedDefinition: SYMPTOM_SPECIALTY_MAP[0] // Default to Orthopedics if neck pain / musculoskeletal
  };

  const { symptomName, matchedDefinition } = detection;
  const { department, doctors, alternatives } = await querySpecialtyDoctorsAndDepartments(matchedDefinition, targetDate);

  let message = '';

  // 1. Specialty Recommendation
  message += `Based on your consultation reason (**${symptomName}**), **${matchedDefinition.specialtyName}** is the recommended specialty.\n\n`;
  message += `${matchedDefinition.guidanceNote}\n\n`;

  // 2. Clinical Guidance Disclaimer
  message += `> **Clinical Guidance Note:** This recommendation is provided as specialty navigation guidance for scheduling and is not a formal diagnostic evaluation.\n\n`;

  // 3. Urgent Warning Signs
  message += `${matchedDefinition.urgentWarning}\n\n`;

  // 4. Doctor Options
  if (doctors.length > 0) {
    message += `### Available Doctors in ${department?.name || matchedDefinition.specialtyName}:\n\n`;
    doctors.forEach((doc, idx) => {
      message += `${idx + 1}. **${doc.name}**\n`;
      message += `   - **Specialization:** ${doc.specialization}\n`;
      message += `   - **Experience:** ${doc.experience} | **Location:** ${doc.roomNumber}\n`;
      message += `   - **Working Hours:** ${doc.workingHours.start} – ${doc.workingHours.end}\n`;

      const slotsToShow = doc.availableSlots.slice(0, 8);
      const dateLabel = targetDate ? ` for ${targetDate}` : '';
      message += `   - **Available Slots${dateLabel}:** ${slotsToShow.join(', ')}${doc.availableSlots.length > 8 ? ' (and more)' : ''}\n\n`;
    });
  } else if (matchedDefinition.alternativeExplanation) {
    message += `### Hospital Department Status:\n\n`;
    message += `${matchedDefinition.alternativeExplanation}\n\n`;

    if (alternatives && alternatives.length > 0) {
      message += `### Available Physicians in General Medicine for Initial Evaluation:\n\n`;
      alternatives.forEach((doc, idx) => {
        message += `${idx + 1}. **${doc.name}** (${doc.specialization})\n`;
        message += `   - **Working Hours:** ${doc.workingHours.start} – ${doc.workingHours.end}\n`;
        const slotsToShow = doc.availableSlots.slice(0, 6);
        message += `   - **Available Slots:** ${slotsToShow.join(', ')}\n\n`;
      });
    }
  } else {
    message += `Currently, our hospital records do not have an active provider registered under ${matchedDefinition.specialtyName}. Our General Medicine team can provide an initial clinical evaluation.\n\n`;
  }

  // 5. Continuation Prompt retaining active state
  const patientNote = patientName ? ` for **${patientName}**` : '';
  const dateNote = targetDate ? ` on **${targetDate}**` : '';
  const timeNote = targetTime ? ` at **${targetTime}**` : '';

  if (targetDate && targetTime) {
    message += `I have noted the appointment details${patientNote} for **${symptomName}**${dateNote}${timeNote}. Which doctor would you like to select to proceed with the booking?`;
  } else {
    message += `Which doctor would you like to schedule with${patientNote}, and what date and time would you prefer?`;
  }

  return {
    detectedSymptom: symptomName,
    specialtyName: matchedDefinition.specialtyName,
    guidanceNote: matchedDefinition.guidanceNote,
    urgentWarning: matchedDefinition.urgentWarning,
    isHospitalSupported: matchedDefinition.isHospitalSupported !== false,
    alternativeExplanation: matchedDefinition.alternativeExplanation,
    department,
    doctors,
    alternatives,
    formattedRecommendationMessage: message
  };
}

// ----------------------------------------------------------------------------
// DOCTOR AVAILABILITY & DIRECT SLOT CHECKING
// ----------------------------------------------------------------------------
export interface DoctorAvailabilityMatch {
  symptomName: string;
  specialtyDef: SpecialtyDefinition;
  department: any | null;
  selectedDoctor: DoctorSlotInfo | null;
  isAvailableAtRequestedTime: boolean;
  timeConflictReason?: string | null;
  doctorOpenSlots: string[];
  alternativeDoctorsInDepartment: DoctorSlotInfo[];
  alternativeGeneralMedicineDocs?: DoctorSlotInfo[];
  allDepartmentDoctors: DoctorSlotInfo[];
  isHospitalSupported: boolean;
}

export async function findBestDoctorAndCheckAvailability(
  symptomText: string,
  targetDate?: string | null,
  targetTime?: string | null,
  preferredDoctorName?: string | null
): Promise<DoctorAvailabilityMatch> {
  const detection = detectSymptomFromText(symptomText) || {
    symptomName: symptomText,
    matchedDefinition: SYMPTOM_SPECIALTY_MAP[0] // Default to Orthopedics if neck pain / musculoskeletal
  };

  const { symptomName, matchedDefinition } = detection;
  const { department, doctors, alternatives } = await querySpecialtyDoctorsAndDepartments(matchedDefinition, targetDate);

  // If specialty is unsupported in hospital (e.g. Dentistry or Ophthalmology)
  if (matchedDefinition.isHospitalSupported === false || (doctors.length === 0 && Boolean(matchedDefinition.alternativeDepartment))) {
    return {
      symptomName,
      specialtyDef: matchedDefinition,
      department: department || null,
      selectedDoctor: null,
      isAvailableAtRequestedTime: false,
      timeConflictReason: matchedDefinition.alternativeExplanation,
      doctorOpenSlots: [],
      alternativeDoctorsInDepartment: [],
      alternativeGeneralMedicineDocs: alternatives || [],
      allDepartmentDoctors: [],
      isHospitalSupported: false
    };
  }

  // Rank doctors by sub-specialty match or user preference
  let chosenDoctor: DoctorSlotInfo | null = null;
  if (preferredDoctorName) {
    const cleanPref = preferredDoctorName.toLowerCase().replace(/^dr\.?\s*/i, '').trim();
    chosenDoctor = doctors.find((d) => d.name.toLowerCase().includes(cleanPref)) || null;
  }

  if (!chosenDoctor && doctors.length > 0) {
    const sLower = symptomName.toLowerCase();
    // Sub-specialty relevance scoring
    const scoredDocs = doctors.map((doc) => {
      let score = 0;
      const spec = doc.specialization.toLowerCase();

      // Spine & Joint matches for neck or back pain
      if (sLower.includes('neck') || sLower.includes('spine') || sLower.includes('cervical') || sLower.includes('back')) {
        if (spec.includes('spine')) score += 10;
        if (spec.includes('joint')) score += 5;
      } else if (sLower.includes('knee') || sLower.includes('sports') || sLower.includes('arthroscopy')) {
        if (spec.includes('sports')) score += 10;
        if (spec.includes('arthroscopy')) score += 8;
      } else if (sLower.includes('chest') || sLower.includes('heart')) {
        if (spec.includes('interventional')) score += 8;
        if (spec.includes('cardio')) score += 5;
      } else if (sLower.includes('stroke') || sLower.includes('headache')) {
        if (spec.includes('stroke') || spec.includes('neurovascular')) score += 8;
        if (spec.includes('cognitive') || spec.includes('neurology')) score += 5;
      }

      return { doc, score };
    });

    scoredDocs.sort((a, b) => b.score - a.score);
    chosenDoctor = scoredDocs[0].doc;
  }

  // If no doctor could be resolved
  if (!chosenDoctor) {
    return {
      symptomName,
      specialtyDef: matchedDefinition,
      department: department || null,
      selectedDoctor: null,
      isAvailableAtRequestedTime: false,
      timeConflictReason: 'No provider available in database.',
      doctorOpenSlots: [],
      alternativeDoctorsInDepartment: [],
      alternativeGeneralMedicineDocs: alternatives || [],
      allDepartmentDoctors: doctors,
      isHospitalSupported: true
    };
  }

  // Availability checking
  let isAvailableAtRequestedTime = true;
  let timeConflictReason: string | null = null;

  if (targetDate && targetTime) {
    const normTarget = targetTime.trim().toUpperCase();
    const hasSlot = chosenDoctor.availableSlots.some((s) => s.toUpperCase() === normTarget);

    if (hasSlot) {
      isAvailableAtRequestedTime = true;
    } else {
      isAvailableAtRequestedTime = false;
      const startMin = parseTimeToMinutes(chosenDoctor.workingHours.start);
      const endMin = parseTimeToMinutes(chosenDoctor.workingHours.end);
      const targetMin = parseTimeToMinutes(targetTime);

      if (targetMin < startMin || targetMin >= endMin) {
        timeConflictReason = `${targetTime} is outside ${chosenDoctor.name}'s clinic working hours (${chosenDoctor.workingHours.start} – ${chosenDoctor.workingHours.end})`;
      } else {
        timeConflictReason = `${chosenDoctor.name} already has an existing appointment booked at ${targetTime} on ${targetDate}`;
      }
    }
  }

  // Find alternative doctors in the same department who are available at the requested time
  const normTime = targetTime ? targetTime.trim().toUpperCase() : null;
  const altDocs = doctors.filter(
    (d) => d.id !== chosenDoctor!.id && (!normTime || d.availableSlots.some((s) => s.toUpperCase() === normTime))
  );

  return {
    symptomName,
    specialtyDef: matchedDefinition,
    department: department || null,
    selectedDoctor: chosenDoctor,
    isAvailableAtRequestedTime,
    timeConflictReason,
    doctorOpenSlots: chosenDoctor.availableSlots,
    alternativeDoctorsInDepartment: altDocs,
    alternativeGeneralMedicineDocs: alternatives || [],
    allDepartmentDoctors: doctors,
    isHospitalSupported: true
  };
}
