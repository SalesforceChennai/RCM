import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import type { Appointment, TimeSlot } from '../types';
import { appointmentService } from '../services/appointmentService';

interface RescheduleModalProps {
  appointment: Appointment | null;
  onClose: () => void;
  onConfirmReschedule: (appointmentId: string, newDate: string, newTime: string) => Promise<void>;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  appointment,
  onClose,
  onConfirmReschedule,
}) => {
  const [rescheduleDate, setRescheduleDate] = useState(appointment?.appointmentDate || '');
  const [rescheduleTime, setRescheduleTime] = useState(appointment?.appointmentTime || '');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadSlots = async () => {
    if (!appointment) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const avail = await appointmentService.getDoctorAvailability(
        appointment.doctorId,
        rescheduleDate,
        rescheduleTime
      );
      setSlots(avail);
    } catch {
      setErrorMsg('Failed to load doctor availability.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (appointment) {
      setRescheduleDate(appointment.appointmentDate);
      setRescheduleTime(appointment.appointmentTime);
    }
  }, [appointment]);

  useEffect(() => {
    if (appointment && rescheduleDate) {
      loadSlots();
    }
  }, [appointment?.doctorId, rescheduleDate, rescheduleTime]);

  if (!appointment) return null;

  const handleSave = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      setErrorMsg('Please select both a date and an available time slot.');
      return;
    }

    try {
      await onConfirmReschedule(appointment.id, rescheduleDate, rescheduleTime);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to reschedule appointment.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Reschedule Appointment</h3>
            <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              {appointment.patient.name} with {appointment.doctor.name}
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#fef2f2',
                border: '1px solid #fecdd3',
                color: '#be123c',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.84375rem',
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date Picker */}
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">
              <Calendar size={14} color="#2563eb" /> Select New Date:
            </label>
            <input
              type="date"
              className="form-input no-icon"
              value={rescheduleDate}
              min="2024-05-01"
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
          </div>

          {/* Time Slot Selection */}
          <div className="form-group">
            <label className="form-label">
              <Clock size={14} color="#2563eb" /> Select Available Time Slot:
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginTop: 6,
                maxHeight: 220,
                overflowY: 'auto',
                padding: 4,
              }}
            >
              {slots.map((slot) => {
                const isSelected = slot.time === rescheduleTime;
                const isBooked = slot.status === 'Booked' && slot.time !== appointment.appointmentTime;

                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={isBooked}
                    onClick={() => {
                      setRescheduleTime(slot.time);
                      setErrorMsg('');
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: isSelected
                        ? '2px solid #2563eb'
                        : isBooked
                        ? '1px solid #fee2e2'
                        : '1px solid #e2e8f0',
                      backgroundColor: isSelected
                        ? '#eff6ff'
                        : isBooked
                        ? '#fff1f2'
                        : '#ffffff',
                      color: isSelected
                        ? '#1d4ed8'
                        : isBooked
                        ? '#9f1239'
                        : '#0f172a',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.8125rem',
                      cursor: isBooked ? 'not-allowed' : 'pointer',
                      opacity: isBooked ? 0.6 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span>{slot.time}</span>
                    <span style={{ fontSize: '0.6875rem' }}>
                      {isSelected ? '✓ Selected' : isBooked ? 'Booked' : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-create-apt"
            onClick={handleSave}
            disabled={isLoading}
          >
            Confirm Reschedule
          </button>
        </div>
      </div>
    </div>
  );
};
