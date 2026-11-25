import type {
  Patient,
  ChargeCaptureEncounter,
  ChargeCaptureItem,
  Appointment,
  InsuranceInfo,
  PatientRegistration
} from '../types';

export interface ChargeCaptureSearchResult {
  patient: Patient;
  appointment?: Appointment | null;
  registration?: PatientRegistration | null;
  insurance?: InsuranceInfo | null;
  chargeCapture?: ChargeCaptureEncounter | null;
}

export const chargeService = {
  async getByPatientId(patientId: string): Promise<ChargeCaptureEncounter | null> {
    try {
      const res = await fetch(`/api/charges?patientId=${encodeURIComponent(patientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          return json.data[0] as ChargeCaptureEncounter;
        }
      }
    } catch (err) {
      console.error('[chargeService] Failed to fetch charges for patient:', err);
    }
    return null;
  },

  async getAll(): Promise<ChargeCaptureEncounter[]> {
    try {
      const res = await fetch('/api/charges');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data as ChargeCaptureEncounter[];
        }
      }
    } catch (err) {
      console.error('[chargeService] Failed to fetch charges:', err);
    }
    return [];
  },

  async save(record: ChargeCaptureEncounter): Promise<ChargeCaptureEncounter> {
    const res = await fetch('/api/charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to save charge encounter in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Database did not return the saved charge encounter.');
    }

    return json.data as ChargeCaptureEncounter;
  },

  async searchPatientsForChargeCapture(query: string): Promise<ChargeCaptureSearchResult[]> {
    const q = query.trim().toLowerCase();
    const [patRes, aptRes, regRes, insRes, chgRes] = await Promise.all([
      fetch('/api/patients').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/appointments').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/registrations').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/insurance').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/charges').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]);

    const patients: Patient[] = Array.isArray(patRes?.data) ? patRes.data : [];
    const appointments: Appointment[] = Array.isArray(aptRes?.data) ? aptRes.data : [];
    const registrations: PatientRegistration[] = Array.isArray(regRes?.data) ? regRes.data : [];
    const insurances: InsuranceInfo[] = Array.isArray(insRes?.data) ? insRes.data : [];
    const charges: ChargeCaptureEncounter[] = Array.isArray(chgRes?.data) ? chgRes.data : [];

    const filteredPatients = patients.filter((p) => {
      if (!q) return true;
      const matchName = `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
      const matchId = p.patientId.toLowerCase().includes(q);
      const matchAppt = appointments.some(
        (a) => a.patientId === p.id && a.appointmentCode.toLowerCase().includes(q)
      );
      const matchCharge = charges.some(
        (c) => c.patientId === p.id && c.id.toLowerCase().includes(q)
      );
      return matchName || matchId || matchAppt || matchCharge;
    });

    return filteredPatients.map((patient) => {
      const patientAppointments = appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      const reg = registrations.find((r) => r.patientId === patient.id) || null;
      const ins = insurances.find((i) => i.patientId === patient.id) || null;
      const charge = charges.find((c) => c.patientId === patient.id) || null;
      return {
        patient,
        appointment: patientAppointments[0] || null,
        registration: reg,
        insurance: ins,
        chargeCapture: charge,
      };
    });
  },

  calculateTotals(
    items: ChargeCaptureItem[],
    expectedInsuranceCoverage: number,
    insuranceReceived: number,
    patientResponsibility: number,
    patientPaid: number
  ) {
    const totalCharges = items.reduce((sum, item) => sum + (Number(item.totalCharge) || 0), 0);
    const safeExpectedInsurance = Math.max(0, Number(expectedInsuranceCoverage) || 0);
    const safeInsuranceReceived = Math.max(0, Number(insuranceReceived) || 0);
    const insurancePending = Math.max(0, safeExpectedInsurance - safeInsuranceReceived);

    const safePatientResponsibility = Math.max(0, Number(patientResponsibility) || 0);
    const safePatientPaid = Math.max(0, Number(patientPaid) || 0);
    const patientPending = Math.max(0, safePatientResponsibility - safePatientPaid);

    const totalOutstandingAR = insurancePending + patientPending;

    return {
      totalCharges,
      expectedInsuranceCoverage: safeExpectedInsurance,
      insuranceReceived: safeInsuranceReceived,
      insurancePending,
      patientResponsibility: safePatientResponsibility,
      patientPaid: safePatientPaid,
      patientPending,
      totalOutstandingAR,
    };
  },
};
