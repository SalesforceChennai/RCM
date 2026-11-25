import type { DashboardStats, Appointment, CardFilterType } from '../types';

export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isUpcomingAppointment(
  appointment: { appointmentDate: string; status: string },
  referenceDate?: string
): boolean {
  const ref = referenceDate || getTodayDateStr();
  if (appointment.appointmentDate > ref) {
    return appointment.status !== 'Cancelled';
  }
  if (appointment.appointmentDate === ref) {
    return appointment.status === 'Scheduled' || appointment.status === 'Confirmed';
  }
  return false;
}

export function filterAppointmentsByCard(
  appointments: Appointment[],
  cardFilter: CardFilterType,
  referenceDate?: string
): Appointment[] {
  const todayDate = referenceDate || getTodayDateStr();
  switch (cardFilter) {
    case 'today':
      return appointments.filter((a) => a.appointmentDate === todayDate);
    case 'upcoming':
      return appointments.filter((a) => isUpcomingAppointment(a, todayDate));
    case 'completed':
      return appointments.filter((a) => a.status === 'Completed');
    case 'cancelled':
      return appointments.filter((a) => a.status === 'Cancelled');
    case 'noshow':
      return appointments.filter((a) => a.status === 'No-show');
    case 'all':
    default:
      return appointments;
  }
}

export function computeDashboardStats(appointments: Appointment[], referenceDate?: string): DashboardStats {
  const ref = referenceDate || getTodayDateStr();
  return {
    todayAppointmentsCount: filterAppointmentsByCard(appointments, 'today', ref).length,
    upcomingAppointmentsCount: filterAppointmentsByCard(appointments, 'upcoming', ref).length,
    completedAppointmentsCount: filterAppointmentsByCard(appointments, 'completed', ref).length,
    cancelledAppointmentsCount: filterAppointmentsByCard(appointments, 'cancelled', ref).length,
    noShowAppointmentsCount: filterAppointmentsByCard(appointments, 'noshow', ref).length,
  };
}

export const statsService = {
  async getDashboardStats(currentDate?: string): Promise<DashboardStats> {
    const refDate = currentDate || getTodayDateStr();

    try {
      const statsRes = await fetch(`/api/appointments/stats?referenceDate=${encodeURIComponent(refDate)}`);
      if (statsRes.ok) {
        const json = await statsRes.json();
        if (json.success && json.data) {
          return json.data as DashboardStats;
        }
      }
    } catch (err) {
      console.error('[statsService] Error fetching dashboard stats from API:', err);
    }

    return {
      todayAppointmentsCount: 0,
      upcomingAppointmentsCount: 0,
      completedAppointmentsCount: 0,
      cancelledAppointmentsCount: 0,
      noShowAppointmentsCount: 0,
    };
  },
};
