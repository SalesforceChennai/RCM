import { getLangChainChatModel } from './sqlAgent.ts';
import type { ChatTurn } from './memory.ts';
import { detectSymptomFromText } from './symptomRecommendation.ts';

// ============================================================================
// STRUCTURED INTENT TYPES
// ============================================================================

export type RcmIntent =
  | 'appointment.create'
  | 'appointment.list'
  | 'appointment.count'
  | 'patient.doctor_query'
  | 'patient.appointments'
  | 'patient.search'
  | 'patient.list'
  | 'patient.count'
  | 'patient.registration'
  | 'patient.check_status'
  | 'claim.list'
  | 'claim.count'
  | 'denial.list'
  | 'denial.count'
  | 'payment.summary'
  | 'payment.list'
  | 'navigation.open'
  | 'action.confirm'
  | 'action.cancel'
  | 'clarification.required'
  | 'sql.query'
  | 'general.chat';

export interface ExtractedEntities {
  patientName?: string | null;
  patientId?: string | null;
  doctorName?: string | null;
  doctorId?: string | null;
  departmentName?: string | null;
  date?: string | null;
  time?: string | null;
  symptoms?: string | null;
  reasonForVisit?: string | null;
  claimStatus?: string | null;
  amount?: number | null;
  limit?: number | null;
  navigationTarget?: string | null;
  searchQuery?: string | null;
  isFollowUp?: boolean;
  queryFocus?: 'doctor' | 'appointment' | 'next_appointment' | 'general';
  // Patient registration fields
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface IntentClassificationResult {
  intent: RcmIntent;
  confidence: number;
  entities: ExtractedEntities;
  isActionRequest: boolean;
  missingRequiredFields?: ('patient' | 'doctor' | 'date' | 'time')[];
  normalizedQuery: string;
  conversationalResponse?: string | null;
  clarificationMessage?: string | null;
}

// ============================================================================
// DATE & TIME NORMALIZERS
// ============================================================================

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim().toLowerCase();

  if (trimmed.includes('tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  }
  if (trimmed.includes('today')) {
    return formatLocalDate(new Date());
  }

  // Check DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const p1 = parseInt(ddmmyyyy[1], 10);
    const p2 = parseInt(ddmmyyyy[2], 10);
    const year = ddmmyyyy[3];
    let day = p1;
    let month = p2;
    if (p1 <= 12 && p2 > 12) {
      month = p1;
      day = p2;
    }
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  // Check YYYY-MM-DD
  const yyyymmdd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const mm = String(parseInt(yyyymmdd[2], 10)).padStart(2, '0');
    const dd = String(parseInt(yyyymmdd[3], 10)).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  return dateStr;
}

export function normalizeTime(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toLowerCase();

  // Match e.g. "morning at 10 AM", "morning 11 o'clock", "11 o'clock", "11:00 AM", "11am", "10am", "at 10 am"
  const match = trimmed.match(/(?:(?:morning|afternoon|evening|night)\s*(?:at\s*)?|(?:at\s*))?(\d{1,2})(?::(\d{2}))?\s*(?:o'?clock|am|pm)?/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    const min = match[2] ? match[2] : '00';
    let meridiem = 'AM';

    if (
      trimmed.includes('pm') ||
      trimmed.includes('evening') ||
      trimmed.includes('afternoon') ||
      (trimmed.includes('night') && hour < 12)
    ) {
      meridiem = 'PM';
    } else if (trimmed.includes('morning') || trimmed.includes('am')) {
      meridiem = 'AM';
    } else if (hour >= 12 && hour < 24) {
      meridiem = 'PM';
      if (hour > 12) hour -= 12;
    } else if (hour >= 1 && hour <= 6) {
      // Default small afternoon hours (e.g. 2 o'clock, 4 o'clock) to PM
      meridiem = 'PM';
    }

    const hh = String(hour).padStart(2, '0');
    return `${hh}:${min} ${meridiem}`;
  }

  return timeStr.toUpperCase();
}

export function extractDateFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|tomorrow|today)\b/i);
  if (match) {
    return normalizeDate(match[1]);
  }
  return null;
}

export function extractTimeFromText(text: string): string | null {
  if (!text) return null;
  // Match e.g. "10 AM", "10:00 AM", "10am", "morning at 10 AM", "at 10 AM", "10 o'clock", "11:30 PM", "11 AM"
  const match = text.match(/\b((?:(?:morning|afternoon|evening|night)\s*(?:at\s*)?|(?:at\s*))?\d{1,2}(?::\d{2})?\s*(?:am|pm|o'?clock)?)\b/i);
  if (match && /\d/.test(match[1])) {
    return normalizeTime(match[1]);
  }
  return null;
}

export function extractPatientNameFromText(text: string): string | null {
  if (!text || !text.trim()) return null;
  const trimmed = text.trim();

  // Words that should never be considered patient names
  const STOPWORDS = new Set([
    'patient', 'patients', 'doctor', 'doctors', 'dr', 'appointment', 'appointments',
    'tomorrow', 'today', 'yesterday', 'morning', 'afternoon', 'evening', 'night',
    'pain', 'neck', 'joint', 'joints', 'knee', 'back', 'spine', 'shoulder', 'tooth', 'teeth',
    'eye', 'eyes', 'heart', 'chest', 'skin', 'ear', 'throat', 'fever', 'cough', 'cold',
    'consult', 'consultation', 'schedule', 'book', 'booking', 'make', 'create',
    'help', 'yes', 'no', 'confirm', 'cancel', 'proceed', 'because', 'with', 'for',
    'and', 'at', 'on', 'in', 'the', 'his', 'her', 'my', 'their', 'our', 'an', 'a',
    'new', 'now', 'am', 'pm', 'clock', 'have', 'has', 'having', 'is', 'was', 'are',
    'want', 'would', 'like', 'need', 'please', 'hey', 'hello', 'hi', 'details', 'check',
    'name', 'names', 'called', 'named'
  ]);

  const cleanCandidate = (name: string): string | null => {
    if (!name) return null;
    const cleaned = name.replace(/[.,!?;:"'(){}[\]]/g, ' ').trim();
    if (!cleaned) return null;
    const rawWords = cleaned.split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return null;

    // Strip leading stopwords (e.g. "name Vijay" -> "Vijay")
    while (rawWords.length > 0 && STOPWORDS.has(rawWords[0].toLowerCase())) {
      rawWords.shift();
    }
    if (rawWords.length === 0) return null;

    // Truncate candidate name as soon as a stopword is encountered (e.g. "Vijay because" -> "Vijay")
    const words: string[] = [];
    for (const w of rawWords) {
      if (STOPWORDS.has(w.toLowerCase())) break;
      if (/^\d+$/.test(w)) break;
      words.push(w);
    }

    if (words.length === 0 || words.length > 3) return null;
    return words.join(' ');
  };

  // 1. "His name is Vijay" / "Patient name is Vijay" / "patient name Vijay" / "a patient name Vijay" / "name Vijay"
  const m1 = trimmed.match(/\b(?:(?:his|her|patient(?:\s*['’]s)?|a\s+patient)\s+)?name\s+(?:is\s+|[:=]\s*)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
  if (m1) {
    const res = cleanCandidate(m1[1]);
    if (res) return res;
  }

  // 2. "Patient name: Vijay" or "Patient: Vijay" or "name: Vijay"
  const m2 = trimmed.match(/\b(?:patient(?:\s+name)?|name)\s*[:=]\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
  if (m2) {
    const res = cleanCandidate(m2[1]);
    if (res) return res;
  }

  // 3. "patient Vijay" or "patient Vijay Anand" or "patient named Vijay" or "patient called Vijay"
  const m3 = trimmed.match(/\bpatient\s+(?:by\s+name\s+|named\s+|called\s+|is\s+|name\s+(?:is\s+|[:=]\s*)?)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
  if (m3) {
    const res = cleanCandidate(m3[1]);
    if (res) return res;
  }

  // 4. "for Vijay" / "for Vijay Anand" / "for name Vijay" / "for patient Vijay"
  const m4 = trimmed.match(/\bfor\s+(?:patient\s+|name\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)(?:,|\.|\s+because|\s+he\b|\s+she\b|\s+who\b|\s+and\b|\s+at\b|\s+on\b|\s+with\b|\s+having\b|(?:\s+for\s+[a-z]+)|\s*$)/i);
  if (m4) {
    const res = cleanCandidate(m4[1]);
    if (res) return res;
  }

  // 5. "Vijay has neck pain" / "Vijay is having neck pain"
  const m5 = trimmed.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:has|is\s+having)\s+(?:[a-z\s]+(?:pain|ache|fever|cough|rash|problem|issue|illness))\b/i);
  if (m5) {
    const res = cleanCandidate(m5[1]);
    if (res) return res;
  }

  // 6. Thanglish: "Vijay ku"
  const m6 = trimmed.match(/\b([A-Za-z]+)\s+ku\b/i);
  if (m6) {
    const res = cleanCandidate(m6[1]);
    if (res) return res;
  }

  return null;
}

// ============================================================================
// GROQ NLU SYSTEM PROMPT
// ============================================================================

export function buildNluSystemPrompt(): string {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  return `You are the primary Natural Language Understanding (NLU) & Intent Classifier for MediCare Healthcare Revenue Cycle Management (RCM).
Analyze the user utterance. Understand natural, informal, broken English, grammar mistakes, spelling errors, short sentences, Tamil-English transliteration (Thanglish), and Tamil.

CURRENT APPLICATION CALENDAR CONTEXT:
- Today's Date: ${todayStr} (Timezone: Asia/Kolkata, IST, Year: 2026)
- Tomorrow's Date: ${tomorrowStr}
- Always resolve relative date words (e.g. "today", "inniku", "tomorrow", "nalaiku", "tmrw") to actual YYYY-MM-DD dates using the above reference.

Thanglish / Tamil Translation Reference:
- "nalaiku" / "naalaiki" = tomorrow
- "inniku" = today
- "mani" = o'clock / hour (e.g. "10 mani" = 10:00 AM, "11 mani" = 11:00 AM)
- "venum" / "theva" = want / need
- "podanum" / "book pannanum" / "create pannanum" / "add pannanum" = need to schedule, create or book
- "oru patient ku" / "patient ku" = for a patient (e.g. "Vijay ku" = for patient Vijay)
- "en patient" = my patient
- "entha doctor suit aagum" / "yaaru doctor" / "oda doctor yaaru" = which doctor suits / who is the consulting doctor
- "kazhuthu vali" = neck pain, "moottu vali" = joint/knee pain, "iduppu vali" = back/hip pain, "pal vali" = tooth pain, "nenju vali" = chest pain
- "vali" / "valikidhu" / "novu" = pain / hurting
- "ethana iruku" / "ethana" / "count enna" = how many are there / count
- "oda details kudu" / "details kudu" / "kaatu" / "kodu" = give or show details
- "eppo" / "eppovadhu" = when / at what time / when is the appointment
- "appointments kaatu" / "appointments kudu" = show appointments
- "denial ethana iruku" = count of denied claims / denials
- "payment details kudu" / "panam evlo vandhuruku" = payment details / money received
- "unpaid claim" / "pending claim" = unpaid or pending claims
- "podu" / "book pannu" / "sari" / "ama" / "proceed pannu" = confirm / proceed
- "vendaam" / "cancel pannu" / "stop" = cancel / abort

INTENT CATEGORIES:
1. appointment.create : User wants to book, create, add, or schedule an appointment (or providing appointment details like "Patient name Vijay", "10 AM tomorrow", "change it to 11 AM", "neck pain")
2. appointment.list : View/show appointments (e.g. "show me 5 appointments", "today's appointments")
3. appointment.count : Count appointments (e.g. "how many appointments")
4. patient.doctor_query : User asks which doctor a patient consults, visits, or which doctor is suitable (e.g. "Which doctor does Shero consult?", "en patient Vijay ku entha doctor suit aagum?", "who is the doctor for Shero?")
5. patient.appointments : User asks to view a specific patient's appointments or appointment schedule (e.g. "Show Shero's appointments", "Show his next appointment", "When is Shero's next appointment?", "When is it?", "Shero appointment details")
6. patient.search : Search/view details of a specific existing patient when NOT asking about doctor consultation or appointments (e.g. "find patient Rahul", "rahul oda details kudu")
7. patient.list : List multiple patients (e.g. "show me 5 patients", "list patients")
8. patient.count : Count of registered patients (e.g. "how many patients we have", "total patients")
9. patient.registration : User wants to register a new patient or is providing registration details (DOB, phone, gender, address)
10. patient.check_status : User asks whether a patient record was saved/added in the database (e.g. "did you add patient Shero?", "is patient saved?", "was Shero added?")
11. claim.list : View/list claims (e.g. "show pending claims", "which claims not processed yet", "show unpaid claims")
12. claim.count : Count of claims
13. denial.count : Count of denials (e.g. "denial ethana iruku", "how many claims denied")
14. denial.list : List denials / reasons for denials
15. payment.summary : Overview of revenue, money received, total collections (e.g. "how much money received", "payment details kudu")
16. payment.list : List payments / remittances
17. navigation.open : Open / go to a page or module (e.g. "take me to medical coding", "open registration")
18. action.confirm : User is confirming a pending action (e.g. "yes", "confirm", "proceed", "book it", "podu", "sari")
19. action.cancel : User cancels a pending action (e.g. "no", "cancel", "vendaam")
20. general.chat : General greetings, polite conversational messages, general questions about the assistant or hospital capabilities
21. sql.query : General RCM analytics question best answered by safe read-only SQL
22. clarification.required : Request is ambiguous or uninterpretable

ENTITY EXTRACTION:
- patientName: Patient name (e.g. "Shero", "Vijay", "Rahul Kumar"). If pronoun like "his" / "he" / "her" is used, resolve it using the conversation context or active workflow state!
- doctorName: Doctor name (e.g. "Dr. Rajesh Sharma", "Dr. Arvind", "Govind")
- departmentName: Department (e.g. "Orthopedics", "Cardiology", "General Medicine")
- symptoms: Patient presenting symptom (e.g. "neck pain", "knee pain", "kazhuthu vali", "skin rash", "tooth pain", "chest pain")
- reasonForVisit: Reason for consultation or medical issue (e.g. "neck pain", "routine checkup")
- date: Date expression resolved to YYYY-MM-DD (e.g. "${tomorrowStr}" for tomorrow/nalaiku, "${todayStr}" for today)
- time: Time expression normalized (e.g. "10:00 AM", "11:00 AM", "03:30 PM")
- claimStatus: e.g. "pending", "unprocessed", "unpaid", "denied", "submitted"
- limit: integer number of records (e.g. 5)
- dob: Date of birth (e.g. "1995-05-15")
- gender: "Male", "Female", or "Other"
- phone: phone number (e.g. "9876543210")
- address: address text

Context & Follow-up Instructions:
- If the user refers to context (e.g. "Show his next appointment", "When is his appointment?"), resolve patientName from the active workflow state or recent conversation.
- If the user modifies an in-flight booking (e.g. "change it to 11 AM", "reschedule to 3 PM", "make it tomorrow"), keep intent as "appointment.create" and populate the updated entity (e.g. time: "11:00 AM").
- When symptoms are mentioned (e.g. "for neck pain", "neck pain", "knee pain"), classify intent as "appointment.create" and populate "symptoms" and "reasonForVisit".

OUTPUT FORMAT:
Return strictly a valid JSON object without markdown or code fences:
{
  "intent": "<intent>",
  "confidence": 0.95,
  "isActionRequest": false,
  "entities": {
    "patientName": null,
    "doctorName": null,
    "departmentName": null,
    "symptoms": null,
    "reasonForVisit": null,
    "date": null,
    "time": null,
    "claimStatus": null,
    "limit": null,
    "dob": null,
    "gender": null,
    "phone": null,
    "address": null,
    "navigationTarget": null
  },
  "missingRequiredFields": [],
  "normalizedQuery": "<Standard English equivalent>",
  "conversationalResponse": null,
  "clarificationMessage": null
}
`;
}

// Candidate models in priority order for Groq
const GROQ_CANDIDATE_MODELS = [
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

/**
 * Robust extractor for relationship questions about patients and their consulting doctors or appointments.
 */
export function detectPatientDoctorOrAppointmentQuery(
  message: string,
  _history: ChatTurn[] = [],
  activeWorkflow?: any
): IntentClassificationResult | null {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Do NOT intercept appointment booking or scheduling commands, or medical consultation/symptom requests
  if (
    /\b(?:book|booking|schedule|scheduling|create|register|new\s+appointment|make\s+(?:an\s+)?appointment|set\s+up|want\s+(?:to\s+)?appointment|want\s+an?\s+appointment|need\s+(?:an?\s+)?appointment|have\s+an?\s+appointment|fix\s+(?:an?\s+)?appointment|appointment\s+a\s+patient|appointment\s+for|appointment\s+tomorrow|appointment\s+today)\b/i.test(lower) ||
    /\b(?:pain|ache|fever|cough|cold|rash|swelling|problem|issue|symptom|consultation|emergency|checkup)\b/i.test(lower)
  ) {
    return null;
  }

  // 1. Follow-up questions referring to active context
  const isFollowUpWhen = /^(when\s+is\s+it\??|when\s+is\s+(?:the\s+)?appointment\??|when\??|what\s+time\??|what\s+date\??|eppovadhu\??|eppo\??)$/i.test(trimmed);
  const isFollowUpDoctor = /^(who\s+is\s+(?:the\s+)?doctor\??|which\s+doctor\??|doctor\s+yaaru\??|who\??|which\s+one\??)$/i.test(trimmed);

  if (isFollowUpWhen || isFollowUpDoctor) {
    const resolvedPatient = activeWorkflow?.patientName || activeWorkflow?.patientId || null;
    return {
      intent: isFollowUpDoctor ? 'patient.doctor_query' : 'patient.appointments',
      confidence: 0.98,
      isActionRequest: false,
      entities: {
        patientName: resolvedPatient,
        isFollowUp: true,
        queryFocus: isFollowUpDoctor ? 'doctor' : 'appointment'
      },
      normalizedQuery: isFollowUpDoctor
        ? `Which doctor does ${resolvedPatient || 'the patient'} consult?`
        : `When is ${resolvedPatient || 'the patient'}'s appointment?`
    };
  }

  // 2. Doctor consultation queries:
  // e.g. "The patient Shero consult which doctor", "Which doctor does Shero consult?", "Shero oda doctor yaaru?", "who is the doctor for Shero"
  const isDoctorConsultQuery =
    /\b(?:consult(?:s|ing)?\s+(?:which|what)?\s*doctor|which\s+doctor.*consult|doctor\s+yaaru|oda\s+doctor|doctor\s+for|who\s+is\s+.*doctor|which\s+doctor)\b/i.test(lower) ||
    (/\bdoctor\b/i.test(lower) && /\b(?:which|who|yaaru|consult|consults|consulting|see|seeing|visit|visits|assigned)\b/i.test(lower)) ||
    /\bconsult\s+which\s+doctor\b/i.test(lower);

  // 3. Patient appointment queries:
  // e.g. "Show Shero's appointments", "When is Shero's next appointment?", "Show appointments of Shero"
  const isPatientApptQuery =
    /\b(?:show|get|view|list|check|find)\s+([A-Za-z0-9_-]+)(?:'s|\s+oda)?\s+appointments?\b/i.test(lower) ||
    /\b([A-Za-z0-9_-]+)(?:'s|\s+oda)\s+appointments?\b/i.test(lower) ||
    /\b(?:when\s+is|next\s+appointment|upcoming\s+appointment)\b/i.test(lower) ||
    /\bappointments?\s+(?:for|of)\s+([A-Za-z0-9_-]+)\b/i.test(lower);

  if (isDoctorConsultQuery || isPatientApptQuery) {
    // Extract patient name
    let patientName: string | null = null;

    // Pattern A: "the patient Shero consult which doctor" or "patient Shero"
    const pMatchA = trimmed.match(/\bpatient\s+([A-Za-z0-9_-]+)/i);
    // Pattern B: "Which doctor does Shero consult" or "does Shero consult"
    const pMatchB = trimmed.match(/(?:does|is|for|with)\s+([A-Za-z0-9_-]+)\s+(?:consult|seeing|visit)/i);
    // Pattern C: "Shero oda doctor yaaru" or "Shero oda appointments"
    const pMatchC = trimmed.match(/\b([A-Za-z0-9_-]+)\s+oda\s+(?:doctor|appointment)/i);
    // Pattern D: "Show Shero's appointments" or "Shero's next appointment"
    const pMatchD = trimmed.match(/\b([A-Za-z0-9_-]+)(?:'s)\s+.*appointment/i);
    // Pattern E: "appointments for Shero" or "doctor for Shero"
    const pMatchE = trimmed.match(/(?:appointments?|doctor)\s+(?:for|of)\s+([A-Za-z0-9_-]+)/i);
    // Pattern F: "Which doctor does Shero"
    const pMatchF = trimmed.match(/which\s+doctor\s+(?:does\s+)?([A-Za-z0-9_-]+)/i);
    // Pattern G: "Shero consult which doctor"
    const pMatchG = trimmed.match(/\b([A-Za-z0-9_-]+)\s+consult(?:s)?\s+which\s+doctor/i);

    const rawPat = pMatchG?.[1] || pMatchA?.[1] || pMatchC?.[1] || pMatchD?.[1] || pMatchB?.[1] || pMatchE?.[1] || pMatchF?.[1];

    if (rawPat && !['doctor', 'patient', 'the', 'which', 'what', 'when', 'who', 'name', 'a', 'an', 'to', 'for'].includes(rawPat.toLowerCase())) {
      patientName = rawPat.trim();
    } else if (activeWorkflow?.patientName) {
      patientName = activeWorkflow.patientName;
    }

    const isNext = /\bnext\b/i.test(lower);

    if (isDoctorConsultQuery) {
      return {
        intent: 'patient.doctor_query',
        confidence: 0.98,
        isActionRequest: false,
        entities: {
          patientName,
          queryFocus: 'doctor'
        },
        normalizedQuery: `Which doctor does patient ${patientName || 'the patient'} consult?`
      };
    } else {
      return {
        intent: 'patient.appointments',
        confidence: 0.98,
        isActionRequest: false,
        entities: {
          patientName,
          queryFocus: isNext ? 'next_appointment' : 'appointment'
        },
        normalizedQuery: isNext
          ? `When is ${patientName || 'the patient'}'s next appointment?`
          : `Show appointments for patient ${patientName || 'the patient'}.`
      };
    }
  }

  return null;
}

/**
 * Classifies a user utterance using Groq LLM into a structured intent & entities.
 */
export async function classifyIntentWithLlm(
  message: string,
  history: ChatTurn[] = [],
  activeWorkflow?: any
): Promise<IntentClassificationResult> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Fast-track common conversational affirmations or cancellations if a confirmation is awaiting
  if (/^(yes|confirm|proceed|book it|book|podu|sari|ama|ok|okay|sure|yep)$/i.test(lower)) {
    return {
      intent: 'action.confirm',
      confidence: 0.99,
      isActionRequest: true,
      entities: {},
      normalizedQuery: 'Yes, proceed with the action.'
    };
  }

  if (/^(no|cancel|stop|abort|vendaam|don't|dont|nevermind)$/i.test(lower)) {
    return {
      intent: 'action.cancel',
      confidence: 0.99,
      isActionRequest: true,
      entities: {},
      normalizedQuery: 'Cancel the action.'
    };
  }

  // Format recent history context (last 6 turns)
  let historyBlock = '';
  if (history.length > 0) {
    const recent = history.slice(-6);
    historyBlock = `\nRecent Conversation:\n` + recent.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n') + '\n';
  }

  let workflowBlock = '';
  if (activeWorkflow && Object.keys(activeWorkflow).length > 0) {
    workflowBlock = `\nActive In-Progress Workflow State: ${JSON.stringify(activeWorkflow)}\n`;
  }

  const prompt = `${buildNluSystemPrompt()}${historyBlock}${workflowBlock}\nUser Utterance: "${trimmed}"\nJSON Output:`;

  for (const modelName of GROQ_CANDIDATE_MODELS) {
    try {
      console.log(`[Groq LLM] Invoking ${modelName} for utterance: "${trimmed}"`);
      const model = await getLangChainChatModel(modelName);
      if (!model) continue;

      const response = await model.invoke(prompt, {
        signal: AbortSignal.timeout(12000)
      });

      const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();

      const parsed: IntentClassificationResult = JSON.parse(cleaned);
      if (parsed && parsed.intent) {
        parsed.entities = parsed.entities || {};
        parsed.confidence = parsed.confidence ?? 0.95;
        parsed.isActionRequest =
          parsed.intent === 'appointment.create' ||
          parsed.intent === 'patient.registration' ||
          parsed.intent === 'action.confirm';
        parsed.normalizedQuery = parsed.normalizedQuery || trimmed;

        // Contextual entity cross-filling and pronoun resolution
        if (!parsed.entities.patientName) {
          const pat = extractPatientNameFromText(trimmed);
          if (pat) {
            parsed.entities.patientName = pat;
          } else if (activeWorkflow?.patientName) {
            // Retain active workflow patient if user refers via pronoun or modifies details
            if (
              /\b(his|her|he|she|it|that patient|the patient|him)\b/i.test(trimmed) ||
              parsed.intent === 'appointment.create' ||
              parsed.intent === 'patient.doctor_query' ||
              parsed.intent === 'patient.appointments'
            ) {
              parsed.entities.patientName = activeWorkflow.patientName;
            }
          }
        }
        if (!parsed.entities.symptoms) {
          const sym = detectSymptomFromText(trimmed);
          if (sym) {
            parsed.entities.symptoms = sym.symptomName;
          } else if (activeWorkflow?.symptoms && parsed.intent === 'appointment.create') {
            parsed.entities.symptoms = activeWorkflow.symptoms;
          }
        }
        if (!parsed.entities.reasonForVisit) {
          parsed.entities.reasonForVisit = parsed.entities.symptoms || detectSymptomFromText(trimmed)?.symptomName || activeWorkflow?.reasonForVisit || null;
        }
        if (!parsed.entities.date) {
          const dt = extractDateFromText(trimmed);
          if (dt) parsed.entities.date = dt;
        }
        if (!parsed.entities.time) {
          const tm = extractTimeFromText(trimmed);
          if (tm) parsed.entities.time = tm;
        }

        // Normalize date and time if present
        if (parsed.entities.date) {
          parsed.entities.date = normalizeDate(parsed.entities.date);
        }
        if (parsed.entities.time) {
          parsed.entities.time = normalizeTime(parsed.entities.time);
        }
        if (parsed.entities.dob) {
          parsed.entities.dob = normalizeDate(parsed.entities.dob);
        }

        return parsed;
      }
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      if (errMsg.includes('429') || errMsg.includes('rate_limit')) {
        console.warn(`[NLU] Rate limit on ${modelName}, trying next model...`);
        continue;
      }
      console.warn(`[NLU] Intent classification error with ${modelName}:`, errMsg);
    }
  }

  // Fallback heuristic if LLM is temporarily unreachable
  return fallbackRuleBasedClassification(trimmed, activeWorkflow);
}

/**
 * Robust rule-based fallback if LLM is temporarily unavailable
 */
function fallbackRuleBasedClassification(message: string, activeWorkflow?: any): IntentClassificationResult {
  const lower = message.toLowerCase();

  // Fast-track doctor relationship or appointment query
  const docOrAppt = detectPatientDoctorOrAppointmentQuery(message, [], activeWorkflow);
  if (docOrAppt) {
    return docOrAppt;
  }

  // Check status query
  if (/\bdid you add|is .* registered|was .* added\b/i.test(lower)) {
    const patMatch = message.match(/\b(?:patient|add)\s+([A-Za-z]+)/i) || message.match(/\b([A-Za-z]+)\s+(?:registered|added)/i);
    return {
      intent: 'patient.check_status',
      confidence: 0.85,
      isActionRequest: false,
      entities: {
        patientName: patMatch ? patMatch[1].trim() : activeWorkflow?.patientName || null
      },
      normalizedQuery: 'Check if patient is registered'
    };
  }

  // Patient registration
  if (/\b(register|new patient|registration)\b/i.test(lower) || (activeWorkflow?.workflowStatus === 'patient_not_found_prompt' && /\byes\b/i.test(lower))) {
    return {
      intent: 'patient.registration',
      confidence: 0.9,
      isActionRequest: true,
      entities: {
        patientName: activeWorkflow?.patientName || null
      },
      normalizedQuery: 'Register new patient'
    };
  }

  // Appointment creation or symptom consultation
  const symptomMatch = detectSymptomFromText(message);
  if (
    symptomMatch ||
    /\b(appointment|book|schedule|podanum|make appointment|add appointment)\b/i.test(lower) ||
    activeWorkflow?.activeIntent === 'appointment.create'
  ) {
    const resolvedPat = extractPatientNameFromText(message) || activeWorkflow?.patientName || null;
    const docMatch = message.match(/\b(?:dr\.?|doctor|with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    const resolvedDate = extractDateFromText(message) || (activeWorkflow?.appointmentDate ? normalizeDate(activeWorkflow.appointmentDate) : null);
    const resolvedTime = extractTimeFromText(message) || (activeWorkflow?.appointmentTime ? normalizeTime(activeWorkflow.appointmentTime) : null);

    return {
      intent: 'appointment.create',
      confidence: 0.88,
      isActionRequest: true,
      entities: {
        patientName: resolvedPat,
        doctorName: docMatch ? docMatch[1].trim() : activeWorkflow?.doctorName || null,
        symptoms: symptomMatch ? symptomMatch.symptomName : activeWorkflow?.symptoms || null,
        reasonForVisit: symptomMatch ? symptomMatch.symptomName : activeWorkflow?.reasonForVisit || null,
        date: resolvedDate,
        time: resolvedTime
      },
      normalizedQuery: `Create appointment for ${resolvedPat || 'patient'}`
    };
  }

  // Patient search or count
  if (/\bhow many patients\b/i.test(lower) || /\b(patient count|total patients)\b/i.test(lower)) {
    return {
      intent: 'patient.count',
      confidence: 0.9,
      isActionRequest: false,
      entities: {},
      normalizedQuery: 'How many patients are registered?'
    };
  }

  if (
    (/\b(find patient|search patient|details kudu|oda details|patient profile)\b/i.test(lower) ||
     (/\bpatient\s+[A-Za-z0-9_-]+/i.test(lower) && !/\b(doctor|dr|consult|consults|consulting|appointment|appointments|when|time|date|yaaru)\b/i.test(lower)))
  ) {
    const nameMatch = message.match(/\b(?:patient|find|details for)\s+([A-Za-z]+)/i) || message.match(/([A-Za-z]+)\s+oda details/i);
    return {
      intent: 'patient.search',
      confidence: 0.85,
      isActionRequest: false,
      entities: {
        patientName: nameMatch ? nameMatch[1].trim() : null
      },
      normalizedQuery: 'Find patient details'
    };
  }

  // Claims
  if (/\b(claims|pending claims|unpaid claims|denial)\b/i.test(lower)) {
    const isDenial = lower.includes('denial');
    const isCount = /\b(how many|ethana|count)\b/i.test(lower);
    if (isDenial && isCount) {
      return { intent: 'denial.count', confidence: 0.85, isActionRequest: false, entities: {}, normalizedQuery: 'How many denials are there?' };
    }
    return {
      intent: 'claim.list',
      confidence: 0.85,
      isActionRequest: false,
      entities: {
        claimStatus: lower.includes('unpaid') ? 'unpaid' : 'pending'
      },
      normalizedQuery: 'Show pending claims'
    };
  }

  // Payment
  if (/\b(money received|revenue|payment|collections|payment details)\b/i.test(lower)) {
    return {
      intent: 'payment.summary',
      confidence: 0.85,
      isActionRequest: false,
      entities: {},
      normalizedQuery: 'Show total payments and revenue received'
    };
  }

  // Default to safe SQL query
  return {
    intent: 'sql.query',
    confidence: 0.7,
    isActionRequest: false,
    entities: {},
    normalizedQuery: message
  };
}
