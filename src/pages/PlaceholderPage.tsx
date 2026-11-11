import React from 'react';
import { CalendarCheck, Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
  onGoToAppointments: () => void;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  onGoToAppointments,
}) => {
  return (
    <div className="page-body animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          padding: '48px 36px',
          maxWidth: 540,
          textAlign: 'center',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)'
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}
        >
          <Construction size={32} />
        </div>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          {title} Module
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', marginBottom: 24, lineHeight: 1.6 }}>
          {description}. This section is scoped for future phases of the MediCare RCM platform.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={onGoToAppointments}
          style={{ margin: '0 auto' }}
        >
          <CalendarCheck size={18} />
          <span>Go to Patient Scheduling</span>
        </button>
      </div>
    </div>
  );
};
