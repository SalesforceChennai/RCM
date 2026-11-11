import type {
  Patient,
  Appointment,
  ChargeCaptureEncounter,
  ChargeCaptureItem,
  DiagnosisCodeItem,
  ProcedureCodeItem,
  MedicalCodingRecord,
  CodingValidationItem
} from '../types';
import { storageService } from './storageService';

export interface StandardCodeItem {
  code: string;
  description: string;
  category?: string;
  defaultUnits?: number;
  defaultCharge?: number;
}

export const STANDARD_ICD10_CODES: StandardCodeItem[] = [
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Circulatory' },
  { code: 'R07.9', description: 'Chest pain, unspecified', category: 'Symptoms & Signs' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery', category: 'Circulatory' },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'General Symptoms' },
  { code: 'R53.1', description: 'Weakness / Generalized fatigue', category: 'General Symptoms' },
  { code: 'E86.0', description: 'Dehydration / Volume depletion', category: 'Metabolic' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
  { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal' },
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis', category: 'Digestive' },
  { code: 'Z00.00', description: 'Encounter for general adult medical examination', category: 'Preventive' },
  { code: 'L20.9', description: 'Atopic dermatitis, unspecified', category: 'Dermatology' },
  { code: 'S83.511A', description: 'Sprain of anterior cruciate ligament of right knee', category: 'Injury' }
];

export const STANDARD_CPT_CODES: StandardCodeItem[] = [
  { code: '99213', description: 'Office/outpatient visit, est patient, low medical complexity (20-29 min)', defaultUnits: 1, defaultCharge: 500, category: 'E/M Consultation' },
  { code: '99214', description: 'Office/outpatient visit, est patient, moderate complexity (30-39 min)', defaultUnits: 1, defaultCharge: 750, category: 'E/M Consultation' },
  { code: '99203', description: 'Office/outpatient visit, new patient, low complexity (30-44 min)', defaultUnits: 1, defaultCharge: 600, category: 'E/M Consultation' },
  { code: '80053', description: 'Comprehensive metabolic panel (Blood Test)', defaultUnits: 1, defaultCharge: 300, category: 'Laboratory' },
  { code: '85025', description: 'Complete blood count (CBC) with automated differential', defaultUnits: 1, defaultCharge: 250, category: 'Laboratory' },
  { code: '71046', description: 'Radiologic examination, chest; 2 views (X-Ray)', defaultUnits: 1, defaultCharge: 700, category: 'Radiology' },
  { code: '93000', description: 'Electrocardiogram (ECG/EKG), routine with interpretation & report', defaultUnits: 1, defaultCharge: 400, category: 'Cardiology' },
  { code: '96360', description: 'Intravenous hydration infusion, initial, 31-60 minutes', defaultUnits: 1, defaultCharge: 300, category: 'Procedure' },
  { code: '11102', description: 'Tangential biopsy of skin lesion', defaultUnits: 1, defaultCharge: 600, category: 'Surgery' }
];

export const STANDARD_MODIFIERS = [
  { code: '—', label: '— None' },
  { code: '25', label: '25 - Significant, separately identifiable E/M service on same day' },
  { code: '59', label: '59 - Distinct procedural service' },
  { code: 'TC', label: 'TC - Technical component only' },
  { code: '26', label: '26 - Professional component only' },
  { code: 'RT', label: 'RT - Right side body part' },
  { code: 'LT', label: 'LT - Left side body part' }
];

export interface MedicalCodingSearchResult {
  patient: Patient;
  appointment?: Appointment | null;
  chargeCapture?: ChargeCaptureEncounter | null;
  codingRecord?: MedicalCodingRecord | null;
}

export const medicalCodingService = {
  getStandardICDCodes(): StandardCodeItem[] {
    return STANDARD_ICD10_CODES;
  },

  getStandardCPTCodes(): StandardCodeItem[] {
    return STANDARD_CPT_CODES;
  },

  getStandardModifiers() {
    return STANDARD_MODIFIERS;
  },

  // Helper to clean code strings (e.g. "CPT-99213" -> "99213", "ICD-10-I10" -> "I10")
  cleanCode(rawCode?: string): string {
    if (!rawCode) return '';
    return rawCode.replace(/^(CPT-|ICD-10-|ICD-|HCPCS-)/i, '').trim();
  },

  // Search patients/encounters awaiting coding
  searchEncounters(query: string): MedicalCodingSearchResult[] {
    const q = query.trim().toLowerCase();
    const patients = storageService.getPatients();
    const appointments = storageService.getAppointments();
    const charges = storageService.getChargeCaptures();
    const codings = storageService.getMedicalCodings();

    const filteredPatients = patients.filter((p) => {
      const matchName = `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
      const matchId = p.patientId.toLowerCase().includes(q);
      const matchAppt = appointments.some(
        (a) => a.patientId === p.id && a.appointmentCode.toLowerCase().includes(q)
      );
      const matchDate = appointments.some(
        (a) => a.patientId === p.id && a.appointmentDate.toLowerCase().includes(q)
      );
      return matchName || matchId || matchAppt || matchDate;
    });

    return filteredPatients.map((patient) => {
      const patientAppointments = appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) => (b.appointmentDate || '').localeCompare(a.appointmentDate || ''));
      const charge = charges.find((c) => c.patientId === patient.id) || null;
      const coding = codings.find((m) => m.patientId === patient.id) || null;

      return {
        patient,
        appointment: patientAppointments[0] || null,
        chargeCapture: charge,
        codingRecord: coding
      };
    });
  },

  // Load or synthesize a coding record for a patient
  getOrCreateCodingRecord(patientId: string): MedicalCodingRecord {
    // 1. Check existing saved record
    const existing = storageService.getMedicalCodingByPatientId(patientId);
    if (existing) {
      return existing;
    }

    const patient = storageService.getPatients().find((p) => p.id === patientId);
    const appointments = storageService.getAppointments().filter((a) => a.patientId === patientId);
    const appt = appointments[0] || null;
    const charge = storageService.getChargeCaptureByPatientId(patientId);

    // Initial captured services from charge encounter if available
    let services: ChargeCaptureItem[] = [];
    if (charge && charge.items && charge.items.length > 0) {
      services = charge.items.map((item) => ({
        ...item,
        procedureCode: this.cleanCode(item.procedureCode),
        diagnosisCode: this.cleanCode(item.diagnosisCode)
      }));
    }

    // Diagnoses derived from charge items
    let diagnoses: DiagnosisCodeItem[] = [];
    const uniqueDx = Array.from(new Set(services.map((s) => s.diagnosisCode).filter(Boolean)));
    if (uniqueDx.length > 0) {
      diagnoses = uniqueDx.map((code, idx) => {
        const match = STANDARD_ICD10_CODES.find((c) => c.code.toLowerCase() === code.toLowerCase());
        return {
          id: `dx-${idx + 1}`,
          type: idx === 0 ? 'Primary' : 'Secondary',
          code: code.toUpperCase(),
          description: match ? match.description : 'Clinical Diagnosis',
          status: 'Validated',
          isPrimary: idx === 0
        };
      });
    }

    // Procedures linked to captured services
    const procedures: ProcedureCodeItem[] = services.map((srv, idx) => {
      const code = this.cleanCode(srv.procedureCode);
      return {
        id: `px-${idx + 1}`,
        serviceId: srv.id,
        serviceDescription: srv.serviceDescription,
        cptCode: code,
        modifier: srv.modifiers || '—',
        units: srv.quantity || 1,
        chargeAmount: srv.totalCharge || 0,
        codingStatus: 'Ready'
      };
    });

    const record: MedicalCodingRecord = {
      id: `COD-${patient?.patientId || Math.floor(10000 + Math.random() * 90000)}-${Date.now().toString().slice(-4)}`,
      encounterId: charge?.id || appt?.appointmentCode || '',
      patientId,
      appointmentId: appt?.id || '',
      encounterDate: charge?.encounterDate || appt?.appointmentDate || new Date().toISOString().split('T')[0],
      doctorId: charge?.doctorId || appt?.doctorId || '',
      doctorName: charge?.doctorName || appt?.doctor?.name || '',
      departmentId: charge?.departmentId || appt?.departmentId || '',
      departmentName: charge?.departmentName || appt?.departmentName || '',
      services,
      diagnoses,
      procedures,
      codingStatus: services.length > 0 ? 'READY FOR CLAIM CREATION' : 'DRAFT',
      updatedAt: new Date().toISOString()
    };

    return record;
  },

  // Perform the 7 mandatory validation checks
  validateCoding(record: MedicalCodingRecord): {
    isValid: boolean;
    messages: CodingValidationItem[];
    canProceedToClaim: boolean;
  } {
    const messages: CodingValidationItem[] = [];

    const { services, diagnoses, procedures } = record;

    // 1. Missing Primary Diagnosis check
    const primaryDiagnoses = diagnoses.filter((d) => d.isPrimary || d.type === 'Primary');
    if (diagnoses.length === 0) {
      messages.push({
        id: 'val-no-dx',
        level: 'Error',
        title: 'Missing Diagnosis Codes',
        message: 'No diagnosis codes added. At least one Primary ICD-10 diagnosis code is mandatory.'
      });
    } else if (primaryDiagnoses.length === 0) {
      messages.push({
        id: 'val-no-primary-dx',
        level: 'Error',
        title: 'Missing Primary Diagnosis',
        message: 'No Primary Diagnosis designated. Please mark one ICD-10 diagnosis as Primary.'
      });
    } else if (primaryDiagnoses.length > 1) {
      messages.push({
        id: 'val-multi-primary-dx',
        level: 'Error',
        title: 'Multiple Primary Diagnoses',
        message: `Only 1 Primary Diagnosis is permitted (${primaryDiagnoses.length} marked). Designate secondary diagnoses as Secondary.`
      });
    } else {
      messages.push({
        id: 'val-primary-ok',
        level: 'Complete',
        title: 'Primary Diagnosis Assigned',
        message: `Primary diagnosis ${primaryDiagnoses[0].code} (${primaryDiagnoses[0].description}) designated successfully.`
      });
    }

    // 2. Duplicate Diagnosis Codes check
    const dxCodesSeen = new Set<string>();
    const duplicateDx = new Set<string>();
    diagnoses.forEach((d) => {
      const code = d.code.trim().toUpperCase();
      if (!code) return;
      if (dxCodesSeen.has(code)) {
        duplicateDx.add(code);
      }
      dxCodesSeen.add(code);
    });
    if (duplicateDx.size > 0) {
      messages.push({
        id: 'val-dup-dx',
        level: 'Error',
        title: 'Duplicate Diagnosis Codes',
        message: `Duplicate ICD-10 code(s) detected: ${Array.from(duplicateDx).join(', ')}. Each diagnosis code should be unique.`
      });
    }

    // 3. Captured Services Coding Checks
    let servicesWithoutProcedure = 0;
    let servicesWithoutDiagnosis = 0;
    let uncodedServices = 0;

    services.forEach((srv) => {
      const hasProc = !!srv.procedureCode && srv.procedureCode.trim() !== '';
      const hasDiag = !!srv.diagnosisCode && srv.diagnosisCode.trim() !== '';

      if (!hasProc) servicesWithoutProcedure++;
      if (!hasDiag) servicesWithoutDiagnosis++;
      if (!hasProc || !hasDiag) uncodedServices++;
    });

    if (services.length === 0) {
      messages.push({
        id: 'val-no-services',
        level: 'Error',
        title: 'No Captured Services',
        message: 'No captured services exist for this patient encounter to code.'
      });
    } else {
      if (servicesWithoutProcedure > 0) {
        messages.push({
          id: 'val-missing-proc',
          level: 'Error',
          title: 'Missing Procedure Codes',
          message: `⚠ ${servicesWithoutProcedure} Service(s) require a standardized CPT / HCPCS procedure code.`
        });
      }

      if (servicesWithoutDiagnosis > 0) {
        messages.push({
          id: 'val-missing-diag',
          level: 'Error',
          title: 'Missing Diagnosis Codes',
          message: `⚠ ${servicesWithoutDiagnosis} Service(s) require a linked ICD-10 diagnosis code.`
        });
      }

      if (uncodedServices > 0) {
        messages.push({
          id: 'val-uncoded',
          level: 'Review',
          title: 'Uncoded Captured Services',
          message: `${uncodedServices} of ${services.length} captured services pending full code assignment.`
        });
      } else {
        messages.push({
          id: 'val-all-coded',
          level: 'Complete',
          title: 'Services Successfully Coded',
          message: `✓ ${services.length} Captured Services Successfully Assigned Valid Codes.`
        });
      }
    }

    // 4. Duplicate Procedure Codes Check
    const procKeySet = new Set<string>();
    const dupProcs = new Set<string>();
    procedures.forEach((p) => {
      const key = `${p.cptCode.trim().toUpperCase()}_${(p.modifier || 'none').trim().toUpperCase()}`;
      if (procKeySet.has(key)) {
        dupProcs.add(p.cptCode.trim());
      }
      procKeySet.add(key);
    });
    if (dupProcs.size > 0) {
      messages.push({
        id: 'val-dup-proc',
        level: 'Review',
        title: 'Duplicate Procedure Codes',
        message: `Duplicate procedure code ${Array.from(dupProcs).join(', ')} without differentiating modifier. Please review units or add modifier (e.g. 59, 76).`
      });
    }

    // 5. Required Modifiers check (e.g. E/M code when multiple procedures exist)
    const hasEMConsultation = procedures.some((p) => ['99213', '99214', '99215', '99203', '99204'].includes(p.cptCode.trim()));
    const hasDiagnosticOrTherapeutic = procedures.some((p) => !['99213', '99214', '99215', '99203', '99204'].includes(p.cptCode.trim()));

    if (hasEMConsultation && hasDiagnosticOrTherapeutic) {
      const emItem = procedures.find((p) => ['99213', '99214', '99215', '99203', '99204'].includes(p.cptCode.trim()));
      if (emItem && (!emItem.modifier || emItem.modifier === '—' || emItem.modifier === '')) {
        messages.push({
          id: 'val-modifier-25',
          level: 'Review',
          title: 'Modifier 25 Advisory',
          message: 'Modifier 25 is recommended on E/M service (' + emItem.cptCode + ') when provided on same day as procedural/diagnostic services to prevent payer denial.'
        });
      }
    }

    // 6. Invalid Code Format Check
    diagnoses.forEach((d) => {
      const c = d.code.trim();
      if (c && !/^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/i.test(c)) {
        messages.push({
          id: `val-fmt-dx-${d.id}`,
          level: 'Review',
          title: 'ICD-10 Format Alert',
          message: `Code "${c}" (${d.description}) does not strictly match standard ICD-10 pattern (e.g. I10, R07.9).`
        });
      }
    });

    const hasErrors = messages.some((m) => m.level === 'Error');
    const canProceed = !hasErrors && services.length > 0 && servicesWithoutProcedure === 0 && servicesWithoutDiagnosis === 0;

    return {
      isValid: !hasErrors,
      messages,
      canProceedToClaim: canProceed
    };
  },

  // Save draft or complete coding, and sync back to charge capture
  saveCoding(record: MedicalCodingRecord, isComplete: boolean = false): MedicalCodingRecord {
    const updatedRecord: MedicalCodingRecord = {
      ...record,
      codingStatus: isComplete ? 'READY FOR CLAIM CREATION' : 'IN PROGRESS',
      updatedAt: new Date().toISOString()
    };

    // Save to storage
    storageService.saveMedicalCoding(updatedRecord);

    // Sync updated codes to Charge Capture module
    const charge = storageService.getChargeCaptureByPatientId(record.patientId);
    if (charge) {
      const updatedItems: ChargeCaptureItem[] = charge.items.map((item) => {
        const matchingSrv = record.services.find((s) => s.id === item.id || s.serviceDescription.toLowerCase() === item.serviceDescription.toLowerCase());
        if (matchingSrv) {
          return {
            ...item,
            procedureCode: matchingSrv.procedureCode,
            diagnosisCode: matchingSrv.diagnosisCode,
            modifiers: matchingSrv.modifiers,
            codingStatus: isComplete ? 'Coded' : (matchingSrv.procedureCode && matchingSrv.diagnosisCode ? 'Coded' : 'Pending Coding')
          };
        }
        return item;
      });

      storageService.saveChargeCapture({
        ...charge,
        items: updatedItems,
        claimStatus: isComplete ? 'Ready to Bill' : charge.claimStatus,
        updatedAt: new Date().toISOString()
      });
    }

    return updatedRecord;
  }
};
