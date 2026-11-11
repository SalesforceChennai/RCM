import type { Doctor } from '../types';
import { storageService } from './storageService';

export const doctorService = {
  async getAll(): Promise<Doctor[]> {
    try {
      const res = await fetch('/api/doctors');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          if (json.data.length > 0) {
            storageService.setDoctors(json.data);
            return json.data;
          }
        }
      }
    } catch {
      // Fallback
    }
    return storageService.getDoctors();
  },

  async getById(id: string): Promise<Doctor | null> {
    try {
      const res = await fetch(`/api/doctors/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Fallback
    }
    const docs = storageService.getDoctors();
    return docs.find((d) => d.id === id) || null;
  },

  async getByDepartment(departmentId: string): Promise<Doctor[]> {
    try {
      const url = (!departmentId || departmentId === 'all')
        ? '/api/doctors'
        : `/api/doctors?departmentId=${encodeURIComponent(departmentId)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch {
      // Fallback
    }
    const docs = storageService.getDoctors();
    if (!departmentId || departmentId === 'all') return docs;
    return docs.filter((d) => d.departmentId === departmentId);
  },

  async create(doctor: Omit<Doctor, 'id'> & { id?: string }): Promise<Doctor> {
    const res = await fetch('/api/doctors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctor),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create doctor in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to save doctor.');
    }

    const current = storageService.getDoctors();
    const updated = [...current.filter(d => d.id !== json.data.id), json.data];
    storageService.setDoctors(updated);

    return json.data;
  },

  async update(id: string, updates: Partial<Doctor>): Promise<Doctor> {
    const res = await fetch(`/api/doctors/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update doctor in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to update doctor.');
    }

    const current = storageService.getDoctors();
    const updated = current.map(d => d.id === id ? { ...d, ...json.data } : d);
    storageService.setDoctors(updated);

    return json.data;
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/doctors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete doctor from database.');
    }

    const current = storageService.getDoctors();
    storageService.setDoctors(current.filter(d => d.id !== id));
  }
};
