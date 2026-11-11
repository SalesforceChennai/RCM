import type {
  Patient,
  ChargeCaptureEncounter,
  ChargeCaptureItem,
  Appointment,
  InsuranceInfo,
  PatientRegistration
} from '../types';
import { storageService } from './storageService';

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
          // If individual charge records exist in PostgreSQL, return cached encounter or mapped
          const cached = storageService.getChargeCaptureByPatientId(patientId);
          if (cached) return cached;
        }
      }
    } catch {
      // Fallback
    }
    return storageService.getChargeCaptureByPatientId(patientId);
  },

  async getAll(): Promise<ChargeCaptureEncounter[]> {
    return storageService.getChargeCaptures();
  },

  async save(record: ChargeCaptureEncounter): Promise<ChargeCaptureEncounter> {
    try {
      // Persist individual charge items to PostgreSQL
      if (record.items && record.items.length > 0) {
        for (const item of record.items) {
          await fetch('/api/charges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chargeId: item.id,
              patientId: record.patientId,
              appointmentId: record.appointmentId,
              doctorId: record.doctorId,
              serviceDescription: item.serviceDescription,
              procedureCode: item.procedureCode,
              diagnosisCode: item.diagnosisCode,
              modifiers: item.modifiers,
              quantity: item.quantity,
              unitRate: item.unitRate,
              chargeAmount: item.totalCharge,
              insuranceExpected: item.insuranceExpected,
              patientExpected: item.patientExpected,
              insurancePaid: item.insurancePaid,
              patientPaid: item.patientPaid,
              codingStatus: item.codingStatus,
              billingStatus: item.billingStatus
            })
          });
        }
      }
    } catch {
      // Fallback
    }

    storageService.saveChargeCapture(record);
    return record;
  },

  async searchPatientsForChargeCapture(query: string): Promise<ChargeCaptureSearchResult[]> {
    const q = query.trim().toLowerCase();
    const patients = storageService.getPatients();
    const appointments = storageService.getAppointments();
    const registrations = storageService.getRegistrations();
    const insurances = storageService.getInsuranceList();
    const charges = storageService.getChargeCaptures();

    const filteredPatients = patients.filter((p) => {
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
        chargeCapture: charge
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
      totalOutstandingAR
    };
  }
};
