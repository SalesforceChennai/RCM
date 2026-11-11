import type { Patient, Appointment } from '../types';
import { storageService } from './storageService';

export const patientService = {
  async getAll(): Promise<Patient[]> {
    try {
      const res = await fetch('/api/patients');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Sync local storage cache with PostgreSQL source of truth
          storageService.setPatients(json.data);
          return json.data;
        }
      }
    } catch {
      // Fallback
    }
    return storageService.getPatients();
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
    } catch {
      // Fallback
    }
    const patients = storageService.getPatients();
    return patients.find((p) => p.id === id || p.patientId.toLowerCase() === id.toLowerCase()) || null;
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
    } catch {
      // Fallback
    }

    const cleanQuery = query.trim().toLowerCase();
    const patients = storageService.getPatients();
    return patients.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      return (
        fullName.includes(cleanQuery) ||
        p.patientId.toLowerCase().includes(cleanQuery) ||
        p.phone.includes(cleanQuery) ||
        (p.email && p.email.toLowerCase().includes(cleanQuery))
      );
    });
  },

  async create(data: Omit<Patient, 'id' | 'patientId'> & { id?: string; patientId?: string }): Promise<Patient> {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
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

    const created = json.data as Patient;
    const current = storageService.getPatients();
    storageService.setPatients([created, ...current.filter((p) => p.id !== created.id)]);
    return created;
  },

  async update(id: string, data: Partial<Patient>): Promise<Patient> {
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updated = json.data as Patient;
          const patients = storageService.getPatients();
          const idx = patients.findIndex((p) => p.id === id || p.patientId === id);
          if (idx >= 0) {
            patients[idx] = updated;
            storageService.setPatients(patients);
          }
          return updated;
        }
      }
    } catch {
      // Fallback
    }

    const patients = storageService.getPatients();
    const index = patients.findIndex((p) => p.id === id || p.patientId.toLowerCase() === id.toLowerCase());
    if (index === -1) {
      throw new Error('Patient not found');
    }

    const updatedPatient: Patient = {
      ...patients[index],
      ...data
    };

    patients[index] = updatedPatient;
    storageService.setPatients(patients);
    return updatedPatient;
  },

  async getPatientAppointmentHistory(patientId: string, patientCode?: string, patientName?: string): Promise<Appointment[]> {
    const appointments = storageService.getAppointments();
    const cleanId = patientId.toLowerCase();
    const cleanCode = (patientCode || '').toLowerCase();
    const cleanName = (patientName || '').toLowerCase();

    const history = appointments.filter((a) => {
      if (a.patientId && a.patientId.toLowerCase() === cleanId) return true;
      if (a.patient?.id && a.patient.id.toLowerCase() === cleanId) return true;
      if (cleanCode && a.patient?.patientCode && a.patient.patientCode.toLowerCase() === cleanCode) return true;
      if (cleanName && a.patient?.name && a.patient.name.toLowerCase() === cleanName) return true;
      return false;
    });

    history.sort((a, b) => {
      if (a.appointmentDate !== b.appointmentDate) {
        return b.appointmentDate.localeCompare(a.appointmentDate);
      }
      return b.appointmentTime.localeCompare(a.appointmentTime);
    });

    return history;
  }
};
