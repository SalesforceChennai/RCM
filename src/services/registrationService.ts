import type { Patient, PatientRegistration, RegistrationStatus, Appointment } from '../types';
import { storageService } from './storageService';

export interface RegistrationSearchResult {
  patient: Patient;
  appointment?: Appointment | null;
  registration?: PatientRegistration | null;
}

export const registrationService = {
  async getRegistration(patientId: string): Promise<PatientRegistration | null> {
    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(patientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          storageService.saveRegistration(json.data);
          return json.data;
        }
      }
    } catch {
      // Fallback
    }
    return storageService.getRegistrationByPatientId(patientId);
  },

  async saveRegistration(data: Omit<PatientRegistration, 'id' | 'updatedAt'> & { id?: string }): Promise<PatientRegistration> {
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const saved = json.data as PatientRegistration;
          storageService.saveRegistration(saved);
          return saved;
        }
      }
    } catch {
      // Fallback
    }

    const existing = storageService.getRegistrationByPatientId(data.patientId);
    const regId = data.id || existing?.id || `reg-${Date.now()}`;
    const record: PatientRegistration = {
      ...data,
      id: regId,
      updatedAt: new Date().toISOString()
    };
    storageService.saveRegistration(record);
    return record;
  },

  async updateRegistrationStatus(patientId: string, status: RegistrationStatus): Promise<PatientRegistration | null> {
    const existing = await this.getRegistration(patientId);
    if (!existing) return null;
    return this.saveRegistration({
      ...existing,
      registrationStatus: status
    });
  },

  async searchPatientsForRegistration(query: string): Promise<RegistrationSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    const patients = storageService.getPatients();
    const appointments = storageService.getAppointments();
    const registrations = storageService.getRegistrations();

    if (!cleanQuery) {
      return patients.slice(0, 8).map((patient) => {
        const patientAppointments = appointments
          .filter((a) => a.patientId === patient.id)
          .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
        const reg = registrations.find((r) => r.patientId === patient.id) || null;
        return {
          patient,
          appointment: patientAppointments[0] || null,
          registration: reg
        };
      });
    }

    const matchedPatients = patients.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const patientIdMatch = p.patientId.toLowerCase().includes(cleanQuery) || p.id.toLowerCase().includes(cleanQuery);
      const nameMatch = fullName.includes(cleanQuery);
      const phoneMatch = p.phone.toLowerCase().includes(cleanQuery);

      const hasMatchingApt = appointments.some(
        (a) => a.patientId === p.id && (a.appointmentCode.toLowerCase().includes(cleanQuery) || a.id.toLowerCase().includes(cleanQuery))
      );

      return patientIdMatch || nameMatch || phoneMatch || hasMatchingApt;
    });

    return matchedPatients.map((patient) => {
      const patientAppointments = appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      const reg = registrations.find((r) => r.patientId === patient.id) || null;
      return {
        patient,
        appointment: patientAppointments[0] || null,
        registration: reg
      };
    });
  }
};
