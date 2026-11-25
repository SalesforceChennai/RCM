import type { Department } from '../types';

export const departmentService = {
  async getAll(): Promise<Department[]> {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[departmentService] Failed to fetch departments:', err);
    }
    return [];
  },

  async getById(id: string): Promise<Department | null> {
    try {
      const res = await fetch(`/api/departments/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[departmentService] Failed to fetch department:', err);
    }
    return null;
  },

  async create(dept: Omit<Department, 'id'> & { id?: string }): Promise<Department> {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dept),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save department in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to save department.');
    }

    return json.data;
  },

  async update(id: string, updates: Partial<Department>): Promise<Department> {
    const res = await fetch(`/api/departments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update department in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to update department.');
    }

    return json.data;
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete department from database.');
    }
  },
};
