import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  CalendarPlus,
  History,
  AlertCircle,
  Stethoscope,
  ShieldCheck,
  DollarSign,
  FileCheck2,
  Clock,
  ArrowRight,
  FileCode2
} from 'lucide-react';
import type { Patient, Appointment } from '../types';
import { patientAggregatorService, type AggregatedPatient } from '../services/patientAggregatorService';
import { storageService } from '../services/storageService';

interface PatientDetailsModalProps {
  patientId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateAppointmentForPatient: (patient: Patient) => void;
  onRegisterPatient?: (patient: Patient) => void;
  onViewAppointmentDetails?: (appointment: Appointment) => void;
  onNavigateToInsurance?: (patientId: string) => void;
  onNavigateToChargeCapture?: (patientId: string) => void;
  onNavigateToMedicalCoding?: (patientId: string) => void;
}

export const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({
  patientId,
  isOpen,
  onClose,
  onCreateAppointmentForPatient,
  onRegisterPatient,
  onViewAppointmentDetails,
  onNavigateToInsurance,
  onNavigateToChargeCapture,
  onNavigateToMedicalCoding,
}) => {
  const [aggregated, setAggregated] = useState<AggregatedPatient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'personal' | 'appointments' | 'insurance' | 'financial'>('all');

  useEffect(() => {
    if (!isOpen || !patientId) {
      setAggregated(null);
      return;
    }

    setLoading(true);
    try {
      const allAggregated = patientAggregatorService.getAggregatedPatients();
      const cleanId = patientId.toLowerCase();
      const match = allAggregated.find(
        (p) => p.id.toLowerCase() === cleanId || p.patientId.toLowerCase() === cleanId
      );
      setAggregated(match || null);
    } catch (err) {
      console.error('Failed to load patient details', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  const currentDate = storageService.getCurrentDate() || '2024-05-31';

  // Split previous and upcoming appointments
  const previousAppointments = aggregated?.allAppointments.filter(
    (a) => a.appointmentDate < currentDate || (a.appointmentDate === currentDate && a.status === 'Completed')
  ) || [];

  const upcomingAppointments = aggregated?.allAppointments.filter(
    (a) => a.appointmentDate > currentDate || (a.appointmentDate === currentDate && a.status !== 'Completed')
  ) || [];

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'confirmed';
      case 'Scheduled':
      case 'Upcoming':
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

  const patientForActions: Patient | null = aggregated
    ? {
        id: aggregated.id,
        patientId: aggregated.patientId,
        firstName: aggregated.firstName,
        lastName: aggregated.lastName,
        dob: aggregated.dob,
        gender: aggregated.gender,
        phone: aggregated.phone,
        email: aggregated.email,
        address: aggregated.address,
        avatar: aggregated.avatar,
        bloodGroup: aggregated.bloodGroup,
        emergencyContact: aggregated.emergencyContact,
      }
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
                  {aggregated ? aggregated.fullName : 'Patient Profile'}
                </h3>
                {aggregated && (
                  <span
                    style={{
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    {aggregated.patientId}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '2px 0 0' }}>
                Complete clinical, demographic, insurance, and financial profile
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Section Tabs */}
        {aggregated && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 24px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'all', label: 'Complete Overview' },
              { id: 'personal', label: '1. Personal Info' },
              { id: 'appointments', label: '2. Appointments & Doctor' },
              { id: 'insurance', label: '3. Insurance Info' },
              { id: 'financial', label: '4. Financial Info' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === tab.id ? '#2563eb' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body with Scroll */}
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Loading patient profile...</div>
            </div>
          ) : !aggregated ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#be123c' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 600 }}>Patient record not found.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Top Highlights Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  backgroundColor: '#ffffff',
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <img
                    src={aggregated.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=140&auto=format&fit=crop&q=80'}
                    alt={aggregated.fullName}
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #3b82f6',
                    }}
                  />
                  <div>
                    <h4 style={{ fontSize: '1.1875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {aggregated.fullName}
                    </h4>
                    <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span><strong>ID:</strong> {aggregated.patientId}</span>
                      <span>•</span>
                      <span><strong>Age:</strong> {aggregated.age} yrs</span>
                      <span>•</span>
                      <span><strong>Gender:</strong> {aggregated.gender}</span>
                      <span>•</span>
                      <span style={{ color: '#be123c', fontWeight: 600 }}>Blood: {aggregated.bloodGroup}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 10,
                      padding: '8px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.71875rem', color: '#2563eb', fontWeight: 600 }}>APPOINTMENT STATUS</div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1e40af' }}>
                      {aggregated.appointmentStatus}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 10,
                      padding: '8px 14px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.71875rem', color: '#16a34a', fontWeight: 600 }}>INSURANCE STATUS</div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#15803d' }}>
                      {aggregated.insuranceStatus}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 1: PERSONAL INFORMATION */}
              {(activeTab === 'all' || activeTab === 'personal') && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                    <User size={18} color="#2563eb" />
                    <h5 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Personal Information
                    </h5>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Patient Name</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.fullName}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Patient ID</div>
                      <div style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.patientId}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Date of Birth</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.dob || 'Not recorded'}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Age & Gender</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.age} years • {aggregated.gender}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Blood Group</div>
                      <div style={{ fontWeight: 700, color: '#be123c', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.bloodGroup}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Phone Number</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.phone}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Email Address</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginTop: 2, wordBreak: 'break-all' }}>
                        {aggregated.email}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Emergency Contact</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.emergencyContact}
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Residential Address</div>
                      <div style={{ fontWeight: 500, color: '#334155', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.address || 'Standard Registered Address'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: APPOINTMENT INFORMATION */}
              {(activeTab === 'all' || activeTab === 'appointments') && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Stethoscope size={18} color="#2563eb" />
                      <h5 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Appointment Information
                      </h5>
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>
                      Total Visits: <strong>{aggregated.allAppointments.length}</strong>
                    </span>
                  </div>

                  {/* Assigned Doctor & Department Highlight */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '0.71875rem', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>
                        Assigned / Consulting Doctor
                      </div>
                      <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.9375rem', marginTop: 4 }}>
                        {aggregated.assignedDoctor?.name || 'Dr. Smith'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 2 }}>
                        {aggregated.assignedDoctor?.specialization || 'Attending Physician'}
                      </div>
                    </div>

                    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.71875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Clinical Department
                      </div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem', marginTop: 4 }}>
                        {aggregated.department?.name || 'General Medicine'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                        Specialized Outpatient Wing
                      </div>
                    </div>

                    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.71875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        Appointment Status
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span className={`status-badge ${getStatusClass(aggregated.appointmentStatus)}`}>
                          {aggregated.appointmentStatus}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                        Last Visit: {aggregated.lastAppointmentDate || 'None recorded'}
                      </div>
                    </div>
                  </div>

                  {/* Upcoming Appointments */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={15} color="#2563eb" /> Upcoming Appointments ({upcomingAppointments.length})
                    </div>
                    {upcomingAppointments.length === 0 ? (
                      <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, fontSize: '0.8125rem', color: '#64748b', textAlign: 'center' }}>
                        No upcoming appointments scheduled.
                      </div>
                    ) : (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date & Time</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Code</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Doctor</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Department</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {upcomingAppointments.map((apt) => (
                              <tr
                                key={apt.id}
                                style={{ borderBottom: '1px solid #f1f5f9', cursor: onViewAppointmentDetails ? 'pointer' : 'default' }}
                                onClick={() => onViewAppointmentDetails && onViewAppointmentDetails(apt)}
                              >
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{apt.appointmentDate} at {apt.appointmentTime}</td>
                                <td style={{ padding: '8px 12px', color: '#2563eb', fontWeight: 600 }}>{apt.appointmentCode}</td>
                                <td style={{ padding: '8px 12px' }}>{apt.doctor.name}</td>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>{apt.departmentName}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span className={`status-badge ${getStatusClass(apt.status)}`}>{apt.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Previous Appointments */}
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <History size={15} color="#64748b" /> Previous Appointments ({previousAppointments.length})
                    </div>
                    {previousAppointments.length === 0 ? (
                      <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, fontSize: '0.8125rem', color: '#64748b', textAlign: 'center' }}>
                        No previous appointment history on record.
                      </div>
                    ) : (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', maxHeight: 180, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date & Time</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Doctor</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Department</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previousAppointments.map((apt) => (
                              <tr
                                key={apt.id}
                                style={{ borderBottom: '1px solid #f1f5f9', cursor: onViewAppointmentDetails ? 'pointer' : 'default' }}
                                onClick={() => onViewAppointmentDetails && onViewAppointmentDetails(apt)}
                              >
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{apt.appointmentDate} ({apt.appointmentTime})</td>
                                <td style={{ padding: '8px 12px' }}>{apt.doctor.name}</td>
                                <td style={{ padding: '8px 12px', color: '#64748b' }}>{apt.departmentName}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span className={`status-badge ${getStatusClass(apt.status)}`}>{apt.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 3: INSURANCE INFORMATION */}
              {(activeTab === 'all' || activeTab === 'insurance') && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} color="#16a34a" />
                      <h5 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Insurance Information
                      </h5>
                    </div>
                    {onNavigateToInsurance && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToInsurance(aggregated.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Verify / Edit Coverage <ArrowRight size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Insurance Provider</div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.insuranceProvider}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Member ID</div>
                      <div style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.memberId}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Policy Number</div>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.875rem', marginTop: 2 }}>
                        {aggregated.policyNumber}
                      </div>
                    </div>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Insurance Status</div>
                      <div style={{ marginTop: 2 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              aggregated.insuranceStatus === 'Active'
                                ? '#dcfce7'
                                : aggregated.insuranceStatus === 'Pending'
                                ? '#fef3c7'
                                : '#fee2e2',
                            color:
                              aggregated.insuranceStatus === 'Active'
                                ? '#15803d'
                                : aggregated.insuranceStatus === 'Pending'
                                ? '#b45309'
                                : '#b91c1c',
                          }}
                        >
                          {aggregated.insuranceStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: FINANCIAL INFORMATION */}
              {(activeTab === 'all' || activeTab === 'financial') && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DollarSign size={18} color="#d97706" />
                      <h5 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Financial Information
                      </h5>
                    </div>
                    {onNavigateToChargeCapture && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToChargeCapture(aggregated.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Charge Capture Ledger <ArrowRight size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Total Charges</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                        ${aggregated.financials.totalCharges.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.71875rem', color: '#94a3b8', marginTop: 2 }}>Cumulative billed</div>
                    </div>

                    <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 500 }}>Insurance Paid</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d', marginTop: 4 }}>
                        ${aggregated.financials.insurancePaid.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.71875rem', color: '#16a34a', marginTop: 2 }}>Payer settled</div>
                    </div>

                    <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 500 }}>Patient Paid</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                        ${aggregated.financials.patientPaid.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.71875rem', color: '#3b82f6', marginTop: 2 }}>Copay / coinsurance</div>
                    </div>

                    <div style={{ padding: '12px 14px', background: aggregated.financials.pendingBalance > 0 ? '#fff1f2' : '#f8fafc', borderRadius: 10, border: `1px solid ${aggregated.financials.pendingBalance > 0 ? '#fecdd3' : '#e2e8f0'}` }}>
                      <div style={{ fontSize: '0.75rem', color: aggregated.financials.pendingBalance > 0 ? '#9f1239' : '#64748b', fontWeight: 500 }}>
                        Pending Balance
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: aggregated.financials.pendingBalance > 0 ? '#be123c' : '#0f172a', marginTop: 4 }}>
                        ${aggregated.financials.pendingBalance.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.71875rem', color: aggregated.financials.pendingBalance > 0 ? '#e11d48' : '#94a3b8', marginTop: 2 }}>
                        {aggregated.financials.pendingBalance > 0 ? 'Outstanding balance' : 'Zero balance'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Close Profile
          </button>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {patientForActions && onRegisterPatient && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onClose();
                  onRegisterPatient(patientForActions);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#4f46e5',
                  borderColor: '#c7d2fe',
                  backgroundColor: '#eef2ff',
                }}
              >
                <FileCheck2 size={16} />
                <span>Intake / Registration</span>
              </button>
            )}

            {onNavigateToMedicalCoding && aggregated && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onClose();
                  onNavigateToMedicalCoding(aggregated.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#7c3aed',
                  borderColor: '#ddd6fe',
                  backgroundColor: '#f5f3ff',
                }}
              >
                <FileCode2 size={16} />
                <span>Medical Coding</span>
              </button>
            )}

            {patientForActions && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onClose();
                  onCreateAppointmentForPatient(patientForActions);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CalendarPlus size={16} />
                <span>Book Appointment</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
