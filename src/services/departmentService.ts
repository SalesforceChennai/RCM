import type { Department } from '../types';
import { storageService } from './storageService';

export const departmentService = {
  async getAll(): Promise<Department[]> {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          storageService.setDepartments(json.data);
          return json.data;
        }
      }
    } catch {
      // Fallback
    }
    return storageService.getDepartments();
  },

  async getById(id: string): Promise<Department | null> {
    try {
      const res = await fetch(`/api/departments/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch {
      // Fallback
    }
    const depts = await this.getAll();
    return depts.find((d) => d.id === id) || null;
  },

  async create(dept: Omit<Department, 'id'> & { id?: string }): Promise<Department> {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dept)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save department in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to save department.');
    }

    // Refresh stored list
    const current = storageService.getDepartments();
    const updated = [...current.filter(d => d.id !== json.data.id), json.data];
    storageService.setDepartments(updated);

    return json.data;
  },

  async update(id: string, updates: Partial<Department>): Promise<Department> {
    const res = await fetch(`/api/departments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update department in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to update department.');
    }

    // Refresh stored list
    const current = storageService.getDepartments();
    const updated = current.map(d => d.id === id ? { ...d, ...json.data } : d);
    storageService.setDepartments(updated);

    return json.data;
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/departments/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete department from database.');
    }

    // Refresh stored list
    const current = storageService.getDepartments();
    storageService.setDepartments(current.filter(d => d.id !== id));
  }
};
