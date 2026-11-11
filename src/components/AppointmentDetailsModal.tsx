import {
  X,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Stethoscope,
  Building2,
  FileText,
  CalendarClock,
  XCircle,
  ClipboardCheck,
  ShieldCheck,
  FileCheck2
} from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../types';

interface AppointmentDetailsModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  onReschedule: (appointment: Appointment) => void;
  onChangeStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onProceedToRegistration?: (patientId: string) => void;
  onProceedToInsurance?: (patientId: string) => void;
  onProceedToPriorAuth?: (patientId: string) => void;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  appointment,
  onClose,
  onReschedule,
  onChangeStatus,
  onProceedToRegistration,
  onProceedToInsurance,
  onProceedToPriorAuth,
}) => {
  if (!appointment) return null;

  const getStatusBadgeClass = (status: AppointmentStatus) => {
    switch (status) {
      case 'Confirmed':
        return 'confirmed';
      case 'Scheduled':
        return 'scheduled';
      case 'Completed':
        return 'completed';
      case 'Cancelled':
        return 'cancelled';
      case 'No-show':
        return 'noshow';
      default:
        return '';
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 className="modal-title">Appointment Details</h3>
              <span className={`status-badge ${getStatusBadgeClass(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 2 }}>
              Reference Code: <strong style={{ color: '#2563eb' }}>{appointment.appointmentCode}</strong>
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Patient Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 16,
              backgroundColor: '#f8fafc',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              marginBottom: 20
            }}
          >
            <img
              src={appointment.patient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
              alt={appointment.patient.name}
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                {appointment.patient.name} ({appointment.patient.patientCode})
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={13} /> {appointment.patient.phone}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={13} /> {appointment.patient.gender}, DOB: {appointment.patient.dob}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
            <div style={{ padding: 14, border: '1px solid #f1f5f9', borderRadius: 10, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78125rem', marginBottom: 4 }}>
                <Stethoscope size={15} color="#2563eb" /> Assigned Doctor
              </div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>{appointment.doctor.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{appointment.departmentName} Department</div>
            </div>

            <div style={{ padding: 14, border: '1px solid #f1f5f9', borderRadius: 10, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78125rem', marginBottom: 4 }}>
                <Calendar size={15} color="#2563eb" /> Schedule Time
              </div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
                {appointment.appointmentDate} at {appointment.appointmentTime}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Duration: {appointment.durationMinutes} Minutes</div>
            </div>

            <div style={{ padding: 14, border: '1px solid #f1f5f9', borderRadius: 10, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78125rem', marginBottom: 4 }}>
                <Building2 size={15} color="#2563eb" /> Appointment Type
              </div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>{appointment.appointmentType}</div>
            </div>

            <div style={{ padding: 14, border: '1px solid #f1f5f9', borderRadius: 10, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78125rem', marginBottom: 4 }}>
                <Mail size={15} color="#2563eb" /> Patient Email
              </div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>{appointment.patient.email || 'N/A'}</div>
            </div>
          </div>

          {/* Address & Reason */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '0.84375rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <MapPin size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
              <span><strong>Address:</strong> {appointment.patient.address || 'Standard Registered Address'}</span>
            </div>

            <div style={{ fontSize: '0.84375rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <FileText size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
              <span><strong>Reason for Visit:</strong> {appointment.reasonForVisit || 'Regular Consultation'}</span>
            </div>
          </div>

          {/* Status Quick Updater */}
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: 10 }}>
              Update Appointment Status:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['Scheduled', 'Confirmed', 'Completed', 'No-show', 'Cancelled'] as AppointmentStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onChangeStatus(appointment.id, st)}
                  className={`status-badge ${getStatusBadgeClass(st)}`}
                  style={{
                    cursor: 'pointer',
                    opacity: appointment.status === st ? 1 : 0.65,
                    border: appointment.status === st ? '2px solid currentColor' : '1px solid transparent'
                  }}
                >
                  {appointment.status === st && '✓ '}
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
          {onProceedToRegistration && (
            <button
              type="button"
              className="btn-secondary"
              style={{ color: '#4f46e5', borderColor: '#c7d2fe', backgroundColor: '#eef2ff' }}
              onClick={() => {
                onClose();
                onProceedToRegistration(appointment.patientId);
              }}
            >
              <ClipboardCheck size={16} />
              <span>Go to Registration</span>
            </button>
          )}

          {onProceedToInsurance && (
            <button
              type="button"
              className="btn-secondary"
              style={{ color: '#059669', borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }}
              onClick={() => {
                onClose();
                onProceedToInsurance(appointment.patientId);
              }}
            >
              <ShieldCheck size={16} />
              <span>Verify Insurance</span>
            </button>
          )}

          {onProceedToPriorAuth && (
            <button
              type="button"
              className="btn-secondary"
              style={{ color: '#0284c7', borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }}
              onClick={() => {
                onClose();
                onProceedToPriorAuth(appointment.patientId);
              }}
            >
              <FileCheck2 size={16} />
              <span>Prior Auth</span>
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onClose();
              onReschedule(appointment);
            }}
          >
            <CalendarClock size={16} />
            <span>Reschedule</span>
          </button>

          {appointment.status !== 'Cancelled' && (
            <button
              type="button"
              className="btn-secondary"
              style={{ color: '#e11d48', borderColor: '#fecdd3' }}
              onClick={() => {
                onChangeStatus(appointment.id, 'Cancelled');
                onClose();
              }}
            >
              <XCircle size={16} />
              <span>Cancel Appointment</span>
            </button>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
