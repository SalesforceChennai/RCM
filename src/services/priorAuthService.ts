import type {
  PriorAuthorization,
  PriorAuthStatus,
  Patient,
  Appointment,
  PatientRegistration,
  InsuranceInfo
} from '../types';
import { getTodayDateStr } from './statsService';

export interface PriorAuthSearchResult {
  patient: Patient;
  appointment?: Appointment | null;
  registration?: PatientRegistration | null;
  insurance?: InsuranceInfo | null;
  authorizations: PriorAuthorization[];
}

export interface ProcedurePreset {
  name: string;
  procedureCode: string;
  diagnosisCode: string;
  departmentId: string;
  departmentName: string;
  estimatedCost: number;
  authorizationRequired: boolean;
  medicalJustification: string;
  supportingDocuments: string[];
}

export const PROCEDURE_PRESETS: ProcedurePreset[] = [
  {
    name: 'MRI Brain with and without Contrast',
    procedureCode: 'CPT 70553',
    diagnosisCode: 'ICD G44.009 (Cluster Headache)',
    departmentId: 'dept-neuro',
    departmentName: 'Neurology',
    estimatedCost: 1950,
    authorizationRequired: true,
    medicalJustification: 'Chronic intractable migraines with progressive neurological visual symptoms refractory to oral triptans.',
    supportingDocuments: ['Clinical Neurology Notes', 'Prior Medication History', 'Visual Field Examination'],
  },
  {
    name: 'Cardiac MRI with Contrast',
    procedureCode: 'CPT 75561',
    diagnosisCode: 'ICD I25.10 (Coronary Artery Disease)',
    departmentId: 'dept-cardio',
    departmentName: 'Cardiology',
    estimatedCost: 1850,
    authorizationRequired: true,
    medicalJustification: 'Evaluation of myocardial viability and ischemic cardiomyopathy following abnormal stress echo.',
    supportingDocuments: ['Stress Echocardiogram Report', 'Cardiologist Consultation Summary', 'ECG Waveform'],
  },
  {
    name: 'Lumbar Spine MRI without Contrast',
    procedureCode: 'CPT 72148',
    diagnosisCode: 'ICD M54.5 (Low Back Pain)',
    departmentId: 'dept-ortho',
    departmentName: 'Orthopedics',
    estimatedCost: 1400,
    authorizationRequired: true,
    medicalJustification: 'Radiculopathy and lumbar spine compression symptoms persistent despite 6 weeks of conservative care.',
    supportingDocuments: ['Physical Therapy Progress Note', 'Orthopedic Examination', 'X-Ray Lumbar Spine'],
  },
  {
    name: 'Knee Arthroscopy & Meniscal Repair',
    procedureCode: 'CPT 29881',
    diagnosisCode: 'ICD M23.22 (Tear of Meniscus)',
    departmentId: 'dept-ortho',
    departmentName: 'Orthopedics',
    estimatedCost: 3200,
    authorizationRequired: true,
    medicalJustification: 'Mechanical knee locking and acute medial meniscus tear confirmed on MRI after failed physical rehabilitation.',
    supportingDocuments: ['MRI Knee Report', 'Surgical Pre-Op Assessment', 'Physical Therapy Records'],
  },
  {
    name: 'CT Chest with IV Contrast',
    procedureCode: 'CPT 71260',
    diagnosisCode: 'ICD R07.9 (Chest Pain / Dyspnea)',
    departmentId: 'dept-gen',
    departmentName: 'General Medicine',
    estimatedCost: 1100,
    authorizationRequired: true,
    medicalJustification: 'Evaluation of persistent unexplained pleuritic chest discomfort and non-resolving pulmonary infiltrate.',
    supportingDocuments: ['Chest X-Ray', 'Pulmonology Clinical Summary', 'Lab Panel (CBC, D-Dimer)'],
  },
  {
    name: 'Echocardiogram (Transthoracic)',
    procedureCode: 'CPT 93306',
    diagnosisCode: 'ICD I50.9 (Heart Failure)',
    departmentId: 'dept-cardio',
    departmentName: 'Cardiology',
    estimatedCost: 650,
    authorizationRequired: false,
    medicalJustification: 'Routine outpatient evaluation of systolic ventricular function.',
    supportingDocuments: ['Cardiology Progress Note'],
  },
  {
    name: 'Routine Specialist Consultation',
    procedureCode: 'CPT 99214',
    diagnosisCode: 'ICD Z00.00 (General Exam)',
    departmentId: 'dept-gen',
    departmentName: 'General Medicine',
    estimatedCost: 180,
    authorizationRequired: false,
    medicalJustification: 'Standard outpatient specialist follow-up for established care management.',
    supportingDocuments: ['Previous Consultation Summary'],
  },
];

export const priorAuthService = {
  async getAll(): Promise<PriorAuthorization[]> {
    try {
      const res = await fetch('/api/prior-authorizations');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[priorAuthService] Failed to fetch prior authorizations:', err);
    }
    return [];
  },

  async getById(id: string): Promise<PriorAuthorization | null> {
    try {
      const res = await fetch(`/api/prior-authorizations/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[priorAuthService] Failed to fetch prior authorization:', err);
    }
    return null;
  },

  async getByPatientId(patientId: string): Promise<PriorAuthorization[]> {
    try {
      const res = await fetch(`/api/prior-authorizations?patientId=${encodeURIComponent(patientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[priorAuthService] Failed to fetch patient prior authorizations:', err);
    }
    return [];
  },

  generateNextRequestId(existingList: PriorAuthorization[] = []): string {
    const numbers = existingList.map((a) => {
      const match = a.authorizationRequestId.match(/PA-(\d+)/i);
      return match ? parseInt(match[1], 10) : 10000;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers, 10000) : 10000;
    return `PA-${maxNum + 1}`;
  },

  generateAuthNumber(provider: string): string {
    const cleanProvider = (provider || 'PAYER')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4);
    const randDigits = Math.floor(100000 + Math.random() * 900000);
    return `AUTH-${cleanProvider}-${randDigits}`;
  },

  async searchPatientsForPriorAuth(query: string): Promise<PriorAuthSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    const [patRes, aptRes, regRes, insRes, authRes] = await Promise.all([
      fetch('/api/patients').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/appointments').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/registrations').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/insurance').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/prior-authorizations').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]);

    const patients: Patient[] = Array.isArray(patRes?.data) ? patRes.data : [];
    const appointments: Appointment[] = Array.isArray(aptRes?.data) ? aptRes.data : [];
    const registrations: PatientRegistration[] = Array.isArray(regRes?.data) ? regRes.data : [];
    const insurances: InsuranceInfo[] = Array.isArray(insRes?.data) ? insRes.data : [];
    const authorizations: PriorAuthorization[] = Array.isArray(authRes?.data) ? authRes.data : [];

    const buildResult = (p: Patient): PriorAuthSearchResult => {
      const pAppointments = appointments
        .filter((a) => a.patientId === p.id)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      const reg = registrations.find((r) => r.patientId === p.id) || null;
      const ins = insurances.find((i) => i.patientId === p.id) || null;
      const patientAuths = authorizations.filter((auth) => auth.patientId === p.id);

      return {
        patient: p,
        appointment: pAppointments[0] || null,
        registration: reg,
        insurance: ins,
        authorizations: patientAuths,
      };
    };

    if (!cleanQuery) {
      return patients.slice(0, 10).map(buildResult);
    }

    const matchedPatients = patients.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const patientIdMatch = p.patientId.toLowerCase().includes(cleanQuery) || p.id.toLowerCase().includes(cleanQuery);
      const nameMatch = fullName.includes(cleanQuery);
      const phoneMatch = p.phone.toLowerCase().includes(cleanQuery);

      const hasMatchingApt = appointments.some(
        (a) => a.patientId === p.id && (a.appointmentCode.toLowerCase().includes(cleanQuery) || a.id.toLowerCase().includes(cleanQuery))
      );

      const hasMatchingAuth = authorizations.some(
        (auth) =>
          auth.patientId === p.id &&
          (auth.authorizationRequestId.toLowerCase().includes(cleanQuery) ||
            (auth.authorizationNumber && auth.authorizationNumber.toLowerCase().includes(cleanQuery)))
      );

      return patientIdMatch || nameMatch || phoneMatch || hasMatchingApt || hasMatchingAuth;
    });

    return matchedPatients.map(buildResult);
  },

  async create(data: Omit<PriorAuthorization, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<PriorAuthorization> {
    const res = await fetch('/api/prior-authorizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to create prior authorization in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Database did not return the created prior authorization.');
    }

    return json.data as PriorAuthorization;
  },

  async update(id: string, data: Partial<PriorAuthorization>): Promise<PriorAuthorization> {
    const res = await fetch(`/api/prior-authorizations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to update prior authorization "${id}".`);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to update prior authorization.');
    }

    return json.data as PriorAuthorization;
  },

  async updateStatus(
    id: string,
    status: PriorAuthStatus,
    details: {
      authorizationNumber?: string;
      validFrom?: string;
      validUntil?: string;
      approvedDate?: string;
      denialReason?: string;
      suggestedAction?: string;
      notes?: string;
    }
  ): Promise<PriorAuthorization> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Prior Authorization with ID "${id}" not found.`);
    }

    const todayStr = getTodayDateStr();

    let authNum = details.authorizationNumber;
    let vFrom = details.validFrom;
    let vUntil = details.validUntil;
    let appDate = details.approvedDate;
    let dReason = details.denialReason;
    let sAction = details.suggestedAction;

    if (status === 'Approved') {
      if (!authNum) {
        authNum = existing.authorizationNumber || this.generateAuthNumber(existing.insuranceProvider);
      }
      if (!vFrom) vFrom = todayStr;
      if (!vUntil) {
        const d = new Date(todayStr);
        d.setMonth(d.getMonth() + 3);
        vUntil = d.toISOString().split('T')[0];
      }
      if (!appDate) appDate = todayStr;
      dReason = undefined;
      sAction = undefined;
    } else if (status === 'Denied') {
      if (!dReason) {
        dReason = 'Clinical documentation does not meet payer medical necessity criteria under standard diagnostic guidelines.';
      }
      if (!sAction) {
        sAction = 'Initiate Peer-to-Peer physician appeal or provide supplementary 6-week conservative treatment logs.';
      }
    } else if (status === 'Not Required') {
      authNum = undefined;
      vFrom = undefined;
      vUntil = undefined;
      dReason = undefined;
      sAction = undefined;
    }

    return this.update(id, {
      status,
      authorizationNumber: authNum,
      validFrom: vFrom,
      validUntil: vUntil,
      approvedDate: appDate,
      denialReason: dReason,
      suggestedAction: sAction,
      notes: details.notes !== undefined ? details.notes : existing.notes,
    });
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/prior-authorizations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to delete prior authorization.');
    }
  },
};
