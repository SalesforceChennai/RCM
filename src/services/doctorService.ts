import type { Doctor } from '../types';

export const doctorService = {
  async getAll(): Promise<Doctor[]> {
    try {
      const res = await fetch('/api/doctors');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[doctorService] Failed to fetch doctors:', err);
    }
    return [];
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
    } catch (err) {
      console.error('[doctorService] Failed to fetch doctor:', err);
    }
    return null;
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
    } catch (err) {
      console.error('[doctorService] Failed to fetch doctors by department:', err);
    }
    return [];
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
  },
};
