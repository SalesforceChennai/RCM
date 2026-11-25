import type { Appointment, AppointmentFilterParams, AppointmentStatus, Doctor, TimeSlot } from '../types';
import { doctorService } from './doctorService';

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  let hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';

  if (hours > 12) {
    hours -= 12;
  } else if (hours === 0) {
    hours = 12;
  }

  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hoursStr}:${minutesStr} ${period}`;
}

export function normalizeTime(timeStr: string): string {
  if (!timeStr) return '';
  return formatMinutesToTime(parseTimeToMinutes(timeStr));
}

export function generateDoctorTimeSlots(startStr: string, endStr: string, intervalMinutes: number = 30): string[] {
  const startMinutes = parseTimeToMinutes(startStr);
  const endMinutes = parseTimeToMinutes(endStr);
  if (startMinutes >= endMinutes) return [];

  const slots: string[] = [];
  for (let m = startMinutes; m <= endMinutes; m += intervalMinutes) {
    slots.push(formatMinutesToTime(m));
  }
  return slots;
}

export const appointmentService = {
  async getAppointments(params: AppointmentFilterParams = {}): Promise<{
    data: Appointment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 6;

    try {
      const qParams = new URLSearchParams();
      if (params.date && params.date !== 'all') qParams.set('date', params.date);
      if (params.startDate) qParams.set('startDate', params.startDate);
      if (params.endDate) qParams.set('endDate', params.endDate);
      if (params.month) qParams.set('month', params.month);
      if (params.doctorId && params.doctorId !== 'all') qParams.set('doctorId', params.doctorId);
      if (params.departmentId && params.departmentId !== 'all') qParams.set('departmentId', params.departmentId);
      if (params.status && params.status !== 'All') qParams.set('status', params.status);
      if (params.searchQuery) qParams.set('searchQuery', params.searchQuery);
      if (params.cardFilter && params.cardFilter !== 'all') qParams.set('cardFilter', params.cardFilter);
      if (params.referenceDate) qParams.set('referenceDate', params.referenceDate);

      const res = await fetch(`/api/appointments?${qParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const all = json.data as Appointment[];
          const total = all.length;
          const totalPages = Math.max(1, Math.ceil(total / limit));
          const startIndex = (page - 1) * limit;
          const paginated = all.slice(startIndex, startIndex + limit);

          return {
            data: paginated,
            total,
            page,
            limit,
            totalPages,
          };
        }
      }
    } catch (err) {
      console.error('[appointmentService] Failed to fetch appointments:', err);
    }

    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  },

  async getAllRaw(): Promise<Appointment[]> {
    try {
      const res = await fetch('/api/appointments');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data as Appointment[];
        }
      }
    } catch (err) {
      console.error('[appointmentService] Failed to fetch all appointments:', err);
    }
    return [];
  },

  async getMonthlyAppointments(monthStr: string, filters: Omit<AppointmentFilterParams, 'month'> = {}): Promise<Appointment[]> {
    try {
      const qParams = new URLSearchParams();
      qParams.set('month', monthStr);
      if (filters.doctorId && filters.doctorId !== 'all') qParams.set('doctorId', filters.doctorId);
      if (filters.departmentId && filters.departmentId !== 'all') qParams.set('departmentId', filters.departmentId);
      if (filters.status && filters.status !== 'All') qParams.set('status', filters.status);
      if (filters.searchQuery) qParams.set('searchQuery', filters.searchQuery);

      const res = await fetch(`/api/appointments?${qParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data as Appointment[];
        }
      }
    } catch (err) {
      console.error('[appointmentService] Failed to fetch monthly appointments:', err);
    }
    return [];
  },

  async getById(id: string): Promise<Appointment | null> {
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('[appointmentService] Failed to fetch appointment by ID:', err);
    }
    return null;
  },

  async getDoctorAvailability(doctorId: string, date: string, selectedTime?: string): Promise<TimeSlot[]> {
    const [doctor, dateRes] = await Promise.all([
      doctorService.getById(doctorId),
      fetch(`/api/appointments?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .catch(() => ({ data: [] })),
    ]);

    const start = doctor?.workingHours?.start || '09:00 AM';
    const end = doctor?.workingHours?.end || '05:00 PM';
    const generatedSlots = generateDoctorTimeSlots(start, end, 30);

    const appointments: Appointment[] = Array.isArray(dateRes?.data) ? dateRes.data : [];
    const bookedTimes = new Set(
      appointments
        .filter((a) => a.status !== 'Cancelled')
        .map((a) => normalizeTime(a.appointmentTime))
    );

    const normSelected = selectedTime ? normalizeTime(selectedTime) : '';

    return generatedSlots.map((time) => {
      const normTime = normalizeTime(time);
      const isBooked = bookedTimes.has(normTime);
      const isSelected = normSelected === normTime;

      let status: 'Available' | 'Booked' | 'Selected' = 'Available';
      if (isBooked) {
        status = 'Booked';
      } else if (isSelected) {
        status = 'Selected';
      }

      return {
        time,
        status,
      };
    });
  },

  async getAvailableDoctors(departmentId: string, date: string): Promise<Doctor[]> {
    const [doctors, dateRes] = await Promise.all([
      doctorService.getByDepartment(departmentId),
      fetch(`/api/appointments?date=${encodeURIComponent(date)}`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .catch(() => ({ data: [] })),
    ]);

    const dateAppointments: Appointment[] = Array.isArray(dateRes?.data) ? dateRes.data : [];
    const availableDocs: Doctor[] = [];

    for (const doc of doctors) {
      const start = doc.workingHours?.start || '09:00 AM';
      const end = doc.workingHours?.end || '05:00 PM';
      const slots = generateDoctorTimeSlots(start, end, 30);
      const bookedTimes = new Set(
        dateAppointments
          .filter((a) => a.doctorId === doc.id && a.status !== 'Cancelled')
          .map((a) => normalizeTime(a.appointmentTime))
      );
      const hasAvailable = slots.some((t) => !bookedTimes.has(normalizeTime(t)));
      if (hasAvailable) {
        availableDocs.push(doc);
      }
    }

    return availableDocs;
  },

  async createAppointment(data: {
    patientId: string;
    doctorId: string;
    departmentId: string;
    appointmentDate: string;
    appointmentTime: string;
    durationMinutes: number;
    appointmentType: Appointment['appointmentType'];
    reasonForVisit: string;
    notes?: string;
  }): Promise<Appointment> {
    // Check slot conflict on server data
    try {
      const checkRes = await fetch(
        `/api/appointments?doctorId=${encodeURIComponent(data.doctorId)}&date=${encodeURIComponent(data.appointmentDate)}`
      );
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        const existing: Appointment[] = Array.isArray(checkJson.data) ? checkJson.data : [];
        const normTarget = normalizeTime(data.appointmentTime);
        const conflict = existing.find(
          (a) => normalizeTime(a.appointmentTime) === normTarget && a.status !== 'Cancelled'
        );
        if (conflict) {
          throw new Error(
            `The selected doctor already has an appointment booked at ${data.appointmentTime} on ${data.appointmentDate}. Please select another time slot.`
          );
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('already has an appointment')) {
        throw err;
      }
    }

    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || errJson.error || 'Failed to create appointment in database.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Database did not return the created appointment.');
    }

    return json.data as Appointment;
  },

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const res = await fetch(`/api/appointments/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to update appointment status.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to update appointment status.');
    }

    return json.data as Appointment;
  },

  async reschedule(id: string, newDate: string, newTime: string): Promise<Appointment> {
    const target = await this.getById(id);
    if (!target) {
      throw new Error('Appointment not found');
    }

    const checkRes = await fetch(
      `/api/appointments?doctorId=${encodeURIComponent(target.doctorId)}&date=${encodeURIComponent(newDate)}`
    );
    if (checkRes.ok) {
      const checkJson = await checkRes.json();
      const existing: Appointment[] = Array.isArray(checkJson.data) ? checkJson.data : [];
      const normNewTime = normalizeTime(newTime);
      const conflict = existing.find(
        (a) => a.id !== id && normalizeTime(a.appointmentTime) === normNewTime && a.status !== 'Cancelled'
      );
      if (conflict) {
        throw new Error(`Doctor is already booked at ${newTime} on ${newDate}. Please choose another time.`);
      }
    }

    const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentDate: newDate,
        appointmentTime: newTime,
        status: 'Confirmed',
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to reschedule appointment.');
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.message || 'Failed to reschedule appointment.');
    }

    return json.data as Appointment;
  },

  async cancelAppointment(id: string): Promise<Appointment> {
    return this.updateStatus(id, 'Cancelled');
  },
};
