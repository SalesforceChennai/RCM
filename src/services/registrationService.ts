import type { Patient, PatientRegistration, RegistrationStatus, Appointment } from '../types';

export interface RegistrationSearchResult {
  patient: Patient;
  appointment?: Appointment | null;
  registration?: PatientRegistration | null;
}

export const registrationService = {
  async getAllRegistrations(): Promise<PatientRegistration[]> {
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[registrationService] Failed to fetch registrations:', err);
    }
    return [];
  },

  async getRegistration(patientId: string): Promise<PatientRegistration | null> {
    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(patientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[registrationService] Failed to fetch registration:', err);
    }
    return null;
  },

  async saveRegistration(data: Omit<PatientRegistration, 'id' | 'updatedAt'> & { id?: string }): Promise<PatientRegistration> {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to save registration in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Database did not return a valid registration record.');
    }

    return json.data as PatientRegistration;
  },

  async updateRegistrationStatus(patientId: string, status: RegistrationStatus): Promise<PatientRegistration | null> {
    const existing = await this.getRegistration(patientId);
    if (!existing) return null;
    return this.saveRegistration({
      ...existing,
      registrationStatus: status,
    });
  },

  async searchPatientsForRegistration(query: string): Promise<RegistrationSearchResult[]> {
    const cleanQuery = query.trim().toLowerCase();
    const [patRes, aptRes, regRes] = await Promise.all([
      fetch('/api/patients').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/appointments').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/registrations').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]);

    const patients: Patient[] = Array.isArray(patRes?.data) ? patRes.data : [];
    const appointments: Appointment[] = Array.isArray(aptRes?.data) ? aptRes.data : [];
    const registrations: PatientRegistration[] = Array.isArray(regRes?.data) ? regRes.data : [];

    if (!cleanQuery) {
      return patients.slice(0, 8).map((patient) => {
        const patientAppointments = appointments
          .filter((a) => a.patientId === patient.id)
          .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
        const reg = registrations.find((r) => r.patientId === patient.id) || null;
        return {
          patient,
          appointment: patientAppointments[0] || null,
          registration: reg,
        };
      });
    }

    const matchedPatients = patients.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const patientIdMatch = p.patientId.toLowerCase().includes(cleanQuery) || p.id.toLowerCase().includes(cleanQuery);
      const nameMatch = fullName.includes(cleanQuery);
      const phoneMatch = p.phone.toLowerCase().includes(cleanQuery);

      const hasMatchingApt = appointments.some(
        (a) =>
          a.patientId === p.id &&
          (a.appointmentCode.toLowerCase().includes(cleanQuery) || a.id.toLowerCase().includes(cleanQuery))
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
        registration: reg,
      };
    });
  },
};
