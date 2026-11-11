import type { DashboardStats, Appointment } from '../types';
import { storageService } from './storageService';

export const statsService = {
  async getDashboardStats(currentDate: string): Promise<DashboardStats> {
    let appointments: Appointment[] = [];

    try {
      // Query PostgreSQL backend directly for truthful live appointment data
      const res = await fetch('/api/appointments');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          appointments = json.data;
          // Synchronize localStorage cache with PostgreSQL
          storageService.setAppointments(appointments);
        }
      }
    } catch (err) {
      console.warn('[statsService] Error fetching live appointments from API, using cached data:', err);
    }

    if (appointments.length === 0) {
      appointments = storageService.getAppointments();
    }

    // Today's appointments (all appointments matching the currentDate)
    const todayAppointments = appointments.filter((a) => a.appointmentDate === currentDate);
    const todayAppointmentsCount = todayAppointments.length;

    // Upcoming appointments (future dates OR scheduled/confirmed on/after currentDate)
    const upcomingAppointments = appointments.filter((a) => {
      if (a.appointmentDate > currentDate) {
        return a.status !== 'Cancelled';
      }
      if (a.appointmentDate === currentDate) {
        return a.status === 'Scheduled' || a.status === 'Confirmed';
      }
      return false;
    });
    const upcomingAppointmentsCount = upcomingAppointments.length;

    // Completed (today or all completed)
    const completedAppointmentsCount = appointments.filter((a) => a.status === 'Completed').length;

    // Cancelled
    const cancelledAppointmentsCount = appointments.filter((a) => a.status === 'Cancelled').length;

    // No-show
    const noShowAppointmentsCount = appointments.filter((a) => a.status === 'No-show').length;

    return {
      todayAppointmentsCount,
      upcomingAppointmentsCount,
      completedAppointmentsCount,
      cancelledAppointmentsCount,
      noShowAppointmentsCount,
    };
  }
};
