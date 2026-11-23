import React from 'react';
import {
  Calendar,
  CalendarCheck2,
  CheckCircle,
  XCircle,
  UserX,
  ArrowRight
} from 'lucide-react';
import type { DashboardStats, CardFilterType } from '../types';

interface StatCardsProps {
  stats: DashboardStats;
  activeCardFilter: CardFilterType;
  onSelectCardFilter: (filter: CardFilterType) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  stats,
  activeCardFilter,
  onSelectCardFilter,
}) => {
  const cards: Array<{
    id: CardFilterType;
    title: string;
    value: number;
    icon: typeof Calendar;
    theme: string;
    actionText: string;
  }> = [
    {
      id: 'today',
      title: "Today's Appointments",
      value: stats.todayAppointmentsCount,
      icon: Calendar,
      theme: 'blue',
      actionText: "View today's schedule",
    },
    {
      id: 'upcoming',
      title: 'Upcoming Appointments',
      value: stats.upcomingAppointmentsCount,
      icon: CalendarCheck2,
      theme: 'green',
      actionText: 'View upcoming',
    },
    {
      id: 'completed',
      title: 'Completed',
      value: stats.completedAppointmentsCount,
      icon: CheckCircle,
      theme: 'purple',
      actionText: 'View completed',
    },
    {
      id: 'cancelled',
      title: 'Cancelled',
      value: stats.cancelledAppointmentsCount,
      icon: XCircle,
      theme: 'red',
      actionText: 'View cancelled',
    },
    {
      id: 'noshow',
      title: 'No-shows',
      value: stats.noShowAppointmentsCount,
      icon: UserX,
      theme: 'orange',
      actionText: 'View no-shows',
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeCardFilter === card.id;

        const handleCardClick = () => {
          if (activeCardFilter === card.id) {
            onSelectCardFilter('all');
          } else {
            onSelectCardFilter(card.id);
          }
        };

        return (
          <div
            key={card.id}
            className={`stat-card ${isActive ? 'active-filter' : ''}`}
            onClick={handleCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }}
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

            <div
              className={`stat-action-link ${card.theme}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCardFilter(card.id);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectCardFilter(card.id);
                }
              }}
            >
              <span>{card.actionText}</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
