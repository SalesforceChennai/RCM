import type { Appointment, AppointmentFilterParams, AppointmentStatus, Doctor, TimeSlot } from '../types';
import { storageService } from './storageService';

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

      const res = await fetch(`/api/appointments?${qParams.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // If we retrieved appointments from PostgreSQL, sync to storageService
          if (json.data.length > 0) {
            storageService.setAppointments(json.data);
          }
          const all = json.data as Appointment[];
          const total = all.length;
          const page = params.page || 1;
          const limit = params.limit || 6;
          const totalPages = Math.max(1, Math.ceil(total / limit));
          const startIndex = (page - 1) * limit;
          const paginated = all.slice(startIndex, startIndex + limit);

          return {
            data: paginated,
            total,
            page,
            limit,
            totalPages
          };
        }
      }
    } catch {
      // Fallback
    }

    let appointments = storageService.getAppointments();

    if (params.date && params.date !== 'all') {
      appointments = appointments.filter((a) => a.appointmentDate === params.date);
    }
    if (params.doctorId && params.doctorId !== 'all') {
      appointments = appointments.filter((a) => a.doctorId === params.doctorId);
    }
    if (params.departmentId && params.departmentId !== 'all') {
      appointments = appointments.filter((a) => a.departmentId === params.departmentId);
    }
    if (params.status && params.status !== 'All') {
      appointments = appointments.filter((a) => a.status === params.status);
    }
    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.trim().toLowerCase();
      appointments = appointments.filter((a) => {
        return (
          a.appointmentCode.toLowerCase().includes(q) ||
          a.patient.name.toLowerCase().includes(q) ||
          a.patient.patientCode.toLowerCase().includes(q) ||
          a.patient.phone.includes(q) ||
          a.doctor.name.toLowerCase().includes(q)
        );
      });
    }

    appointments.sort((a, b) => {
      if (a.appointmentDate !== b.appointmentDate) {
        return a.appointmentDate.localeCompare(b.appointmentDate);
      }
      return a.appointmentTime.localeCompare(b.appointmentTime);
    });

    const total = appointments.length;
    const page = params.page || 1;
    const limit = params.limit || 6;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paginated = appointments.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
      totalPages
    };
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
    } catch {
      // Fallback
    }
    const list = storageService.getAppointments();
    return list.find((a) => a.id === id || a.appointmentCode.toLowerCase() === id.toLowerCase()) || null;
  },

  async getDoctorAvailability(doctorId: string, date: string, selectedTime?: string): Promise<TimeSlot[]> {
    const doctors = storageService.getDoctors();
    const doctor = doctors.find((d) => d.id === doctorId);

    const start = doctor?.workingHours?.start || '09:00 AM';
    const end = doctor?.workingHours?.end || '05:00 PM';
    const generatedSlots = generateDoctorTimeSlots(start, end, 30);

    const appointments = storageService.getAppointments();
    const bookedTimes = new Set(
      appointments
        .filter((a) => a.doctorId === doctorId && a.appointmentDate === date && a.status !== 'Cancelled')
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
        status
      };
    });
  },

  async getAvailableDoctors(departmentId: string, date: string): Promise<Doctor[]> {
    const doctors = storageService.getDoctors();
    const filtered = (!departmentId || departmentId === 'all')
      ? doctors
      : doctors.filter((d) => d.departmentId === departmentId);

    const availableDocs: Doctor[] = [];
    for (const doc of filtered) {
      const slots = await this.getDoctorAvailability(doc.id, date);
      const hasAvailable = slots.some((s) => s.status === 'Available');
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
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const created = json.data as Appointment;
          const current = storageService.getAppointments();
          storageService.setAppointments([created, ...current]);
          return created;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      // Fallback
    }

    const appointments = storageService.getAppointments();
    const patients = storageService.getPatients();
    const doctors = storageService.getDoctors();
    const departments = storageService.getDepartments();

    // Check Conflict
    const conflict = appointments.find(
      (a) =>
        a.doctorId === data.doctorId &&
        a.appointmentDate === data.appointmentDate &&
        a.appointmentTime === data.appointmentTime &&
        a.status !== 'Cancelled'
    );

    if (conflict) {
      throw new Error(`The selected doctor already has an appointment booked at ${data.appointmentTime} on ${data.appointmentDate}. Please select another time slot.`);
    }

    const patient = patients.find((p) => p.id === data.patientId);
    if (!patient) throw new Error('Patient not found');

    const doctor = doctors.find((d) => d.id === data.doctorId);
    if (!doctor) throw new Error('Doctor not found');

    const department = departments.find((dept) => dept.id === data.departmentId);
    const nextNumber = appointments.length + 15;
    const appointmentCode = `APT${10000 + nextNumber}`;

    const newAppointment: Appointment = {
      id: `apt-${Date.now()}`,
      appointmentCode,
      patientId: patient.id,
      patient: {
        id: patient.id,
        patientCode: patient.patientId,
        name: `${patient.firstName} ${patient.lastName}`,
        phone: patient.phone,
        avatar: patient.avatar,
        gender: patient.gender,
        dob: patient.dob,
        email: patient.email,
        address: patient.address
      },
      doctorId: doctor.id,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        avatar: doctor.avatar,
        department: doctor.departmentName
      },
      departmentId: data.departmentId,
      departmentName: department?.name || doctor.departmentName,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      durationMinutes: data.durationMinutes,
      appointmentType: data.appointmentType,
      status: 'Confirmed',
      reasonForVisit: data.reasonForVisit,
      notes: data.notes,
      createdAt: new Date().toISOString()
    };

    const updated = [newAppointment, ...appointments];
    storageService.setAppointments(updated);
    return newAppointment;
  },

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const updated = json.data as Appointment;
          const current = storageService.getAppointments();
          const idx = current.findIndex((a) => a.id === id || a.appointmentCode === id);
          if (idx >= 0) {
            current[idx] = updated;
            storageService.setAppointments(current);
          }
          return updated;
        }
      }
    } catch {
      // Fallback
    }

    const appointments = storageService.getAppointments();
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error('Appointment not found');
    }

    const updatedAppointment = {
      ...appointments[index],
      status
    };

    appointments[index] = updatedAppointment;
    storageService.setAppointments(appointments);
    return updatedAppointment;
  },

  async reschedule(id: string, newDate: string, newTime: string): Promise<Appointment> {
    const appointments = storageService.getAppointments();
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error('Appointment not found');
    }

    const target = appointments[index];
    const conflict = appointments.find(
      (a) =>
        a.id !== id &&
        a.doctorId === target.doctorId &&
        a.appointmentDate === newDate &&
        a.appointmentTime === newTime &&
        a.status !== 'Cancelled'
    );

    if (conflict) {
      throw new Error(`Doctor is already booked at ${newTime} on ${newDate}. Please choose another time.`);
    }

    const updatedAppointment = {
      ...target,
      appointmentDate: newDate,
      appointmentTime: newTime,
      status: 'Confirmed' as AppointmentStatus
    };

    appointments[index] = updatedAppointment;
    storageService.setAppointments(appointments);
    return updatedAppointment;
  },

  async cancelAppointment(id: string): Promise<Appointment> {
    return this.updateStatus(id, 'Cancelled');
  }
};
