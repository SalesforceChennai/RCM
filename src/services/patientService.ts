import type { Patient, Appointment } from '../types';

export const patientService = {
  async getAll(): Promise<Patient[]> {
    try {
      const res = await fetch('/api/patients');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[patientService] Failed to fetch patients:', err);
    }
    return [];
  },

  async getById(id: string): Promise<Patient | null> {
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[patientService] Failed to fetch patient:', err);
    }
    return null;
  },

  async search(query: string): Promise<Patient[]> {
    if (!query || !query.trim()) {
      return this.getAll();
    }
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[patientService] Failed to search patients:', err);
    }
    return [];
  },

  async create(data: Omit<Patient, 'id' | 'patientId'> & { id?: string; patientId?: string }): Promise<Patient> {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      let errorMsg = `Failed to create patient (HTTP ${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.error || errJson.message) {
          errorMsg = errJson.error || errJson.message;
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(errorMsg);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || json.error || 'Database did not return a valid patient record.');
    }

    return json.data as Patient;
  },

  async update(id: string, data: Partial<Patient>): Promise<Patient> {
    const res = await fetch(`/api/patients/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || errJson.error || `Failed to update patient (HTTP ${res.status})`);
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Database did not return an updated patient record.');
    }

    return json.data as Patient;
  },

  async getPatientAppointmentHistory(patientId: string): Promise<Appointment[]> {
    try {
      const res = await fetch(`/api/appointments?patientId=${encodeURIComponent(patientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const history = json.data as Appointment[];
          history.sort((a, b) => {
            if (a.appointmentDate !== b.appointmentDate) {
              return b.appointmentDate.localeCompare(a.appointmentDate);
            }
            return b.appointmentTime.localeCompare(a.appointmentTime);
          });
          return history;
        }
      }
    } catch (err) {
      console.error('[patientService] Failed to fetch appointment history:', err);
    }
    return [];
  },
};
