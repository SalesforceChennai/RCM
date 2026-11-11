import React from 'react';
import {
  Calendar,
  CalendarCheck2,
  CheckCircle,
  XCircle,
  UserX,
  ArrowRight
} from 'lucide-react';
import type { DashboardStats, AppointmentStatus } from '../types';

interface StatCardsProps {
  stats: DashboardStats;
  activeStatusFilter: AppointmentStatus | 'All';
  onSelectFilter: (filter: AppointmentStatus | 'All') => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  stats,
  activeStatusFilter,
  onSelectFilter,
}) => {
  const cards = [
    {
      id: 'today',
      title: "Today's Appointments",
      value: stats.todayAppointmentsCount,
      icon: Calendar,
      theme: 'blue',
      actionText: "View today's schedule",
      statusFilter: 'All' as const,
    },
    {
      id: 'upcoming',
      title: 'Upcoming Appointments',
      value: stats.upcomingAppointmentsCount,
      icon: CalendarCheck2,
      theme: 'green',
      actionText: 'View upcoming',
      statusFilter: 'Confirmed' as const,
    },
    {
      id: 'completed',
      title: 'Completed',
      value: stats.completedAppointmentsCount,
      icon: CheckCircle,
      theme: 'purple',
      actionText: 'View completed',
      statusFilter: 'Completed' as const,
    },
    {
      id: 'cancelled',
      title: 'Cancelled',
      value: stats.cancelledAppointmentsCount,
      icon: XCircle,
      theme: 'red',
      actionText: 'View cancelled',
      statusFilter: 'Cancelled' as const,
    },
    {
      id: 'noshow',
      title: 'No-shows',
      value: stats.noShowAppointmentsCount,
      icon: UserX,
      theme: 'orange',
      actionText: 'View no-shows',
      statusFilter: 'No-show' as const,
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeStatusFilter === card.statusFilter && card.statusFilter !== 'All';

        return (
          <div
            key={card.id}
            className={`stat-card ${isActive ? 'active-filter' : ''}`}
            onClick={() => onSelectFilter(card.statusFilter)}
          >
            <div className="stat-card-header">
              <div className={`stat-icon-wrapper ${card.theme}`}>
                <Icon size={22} strokeWidth={2.2} />
              </div>
              <div>
                <div className="stat-label-title">{card.title}</div>
                <div className="stat-count-value">{card.value}</div>
              </div>
            </div>

            <div className={`stat-action-link ${card.theme}`}>
              <span>{card.actionText}</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
