import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Stethoscope,
  FileText,
  Search,
  Plus,
  XCircle,
  CalendarPlus,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import type {
  Patient,
  Doctor,
  Department,
  AppointmentType,
  Gender,
  TimeSlot
} from '../types';
import { patientService } from '../services/patientService';
import { doctorService } from '../services/doctorService';
import { departmentService } from '../services/departmentService';
import { appointmentService } from '../services/appointmentService';
import { NewPatientModal } from '../components/NewPatientModal';

interface NewAppointmentPageProps {
  onCancel: () => void;
  onAppointmentCreated: () => void;
  onOpenNewPatientModal?: () => void;
  newlyCreatedPatient: Patient | null;
  preselectedPatient?: Patient | null;
  onError: (msg: string) => void;
}

export const NewAppointmentPage: React.FC<NewAppointmentPageProps> = ({
  onCancel,
  onAppointmentCreated,
  onOpenNewPatientModal,
  newlyCreatedPatient,
  preselectedPatient,
  onError,
}) => {
  // Lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLocalPatientModalOpen, setIsLocalPatientModalOpen] = useState(false);

  // Search autocomplete
  const [patientSearchQuery, setPatientSearchQuery] = useState(
    preselectedPatient ? `${preselectedPatient.firstName} ${preselectedPatient.lastName} (${preselectedPatient.patientId})` : ''
  );
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Selected / Form Patient State - empty by default unless preselected
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatient?.id || '');
  const [patientIdCode, setPatientIdCode] = useState<string>(preselectedPatient?.patientId || '');
  const [firstName, setFirstName] = useState<string>(preselectedPatient?.firstName || '');
  const [lastName, setLastName] = useState<string>(preselectedPatient?.lastName || '');
  const [dob, setDob] = useState<string>(preselectedPatient?.dob || '');
  const [gender, setGender] = useState<Gender | ''>(preselectedPatient?.gender || '');
  const [phone, setPhone] = useState<string>(preselectedPatient?.phone || '');
  const [email, setEmail] = useState<string>(preselectedPatient?.email || '');
  const [address, setAddress] = useState<string>(preselectedPatient?.address || '');

  // Appointment Details State
  const [selectedDeptId, setSelectedDeptId] = useState<string>('dept-cardio');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('doc-smith');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('Consultation');
  const [appointmentDate, setAppointmentDate] = useState<string>('2024-05-31');
  const [appointmentTime, setAppointmentTime] = useState<string>('10:30 AM');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [reasonForVisit, setReasonForVisit] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>('');

  // Initial Data Load
  useEffect(() => {
    loadInitialData();
  }, []);

  // When preselectedPatient changes from Patient Details modal
  useEffect(() => {
    if (preselectedPatient) {
      applyPatient(preselectedPatient);
    } else {
      resetPatientFields();
    }
  }, [preselectedPatient]);

  // When newlyCreatedPatient changes from parent modal
  useEffect(() => {
    if (newlyCreatedPatient) {
      applyPatient(newlyCreatedPatient);
    }
  }, [newlyCreatedPatient]);

  const resetPatientFields = () => {
    setSelectedPatientId('');
    setPatientIdCode('');
    setFirstName('');
    setLastName('');
    setDob('');
    setGender('');
    setPhone('');
    setEmail('');
    setAddress('');
    setPatientSearchQuery('');
    setShowSearchResults(false);
  };

  const handleNewPatientClick = () => {
    setFormError('');
    if (onOpenNewPatientModal) {
      onOpenNewPatientModal();
    } else {
      setIsLocalPatientModalOpen(true);
    }
  };

  const handlePatientCreatedLocal = (patient: Patient) => {
    applyPatient(patient);
    setIsLocalPatientModalOpen(false);
  };

  const loadInitialData = async () => {
    try {
      const [deptList, docList] = await Promise.all([
        departmentService.getAll(),
        doctorService.getAll(),
      ]);
      setDepartments(deptList);
      setDoctors(docList);
    } catch {
      onError('Failed to load initial scheduling form data');
    }
  };

  // Filter doctors with at least one available slot on appointmentDate
  useEffect(() => {
    const updateDoctorsList = async () => {
      if (!selectedDeptId || !appointmentDate) return;
      try {
        const availableDocs = await appointmentService.getAvailableDoctors(selectedDeptId, appointmentDate);
        setFilteredDoctors(availableDocs);

        if (availableDocs.length > 0) {
          const isSelectedStillValid = availableDocs.some((d) => d.id === selectedDoctorId);
          if (!isSelectedStillValid) {
            setSelectedDoctorId(availableDocs[0].id);
          }
        } else {
          setSelectedDoctorId('');
        }
      } catch {
        const fallback = doctors.filter((d) => d.departmentId === selectedDeptId);
        setFilteredDoctors(fallback);
      }
    };

    updateDoctorsList();
  }, [selectedDeptId, appointmentDate, doctors]);

  // When department changes -> update department state
  const handleDepartmentChange = (deptId: string) => {
    setSelectedDeptId(deptId);
  };

  // Fetch doctor availability when doctor, date or time changes
  useEffect(() => {
    if (selectedDoctorId && appointmentDate) {
      loadDoctorAvailability(selectedDoctorId, appointmentDate, appointmentTime);
    } else {
      setTimeSlots([]);
    }
  }, [selectedDoctorId, appointmentDate, appointmentTime]);

  const loadDoctorAvailability = async (docId: string, date: string, selectedT: string) => {
    if (!docId) {
      setTimeSlots([]);
      return;
    }
    try {
      const slots = await appointmentService.getDoctorAvailability(docId, date, selectedT);
      setTimeSlots(slots);

      // If current appointmentTime is not available or not in slots, auto-select first available slot
      const currentSelectedSlot = slots.find((s) => s.time === selectedT);
      if (!currentSelectedSlot || currentSelectedSlot.status === 'Booked') {
        const firstAvail = slots.find((s) => s.status === 'Available');
        if (firstAvail) {
          setAppointmentTime(firstAvail.time);
        }
      }
    } catch {
      onError('Unable to calculate doctor slot availability');
    }
  };

  // Patient live search
  const handlePatientSearchChange = async (query: string) => {
    setPatientSearchQuery(query);
    if (!query.trim()) {
      setPatientSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearchingPatient(true);
    try {
      const results = await patientService.search(query);
      setPatientSearchResults(results);
      setShowSearchResults(true);
    } catch {
      setPatientSearchResults([]);
    } finally {
      setIsSearchingPatient(false);
    }
  };

  const applyPatient = (p: Patient) => {
    setSelectedPatientId(p.id);
    setPatientIdCode(p.patientId);
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setDob(p.dob);
    setGender(p.gender);
    setPhone(p.phone);
    setEmail(p.email || '');
    setAddress(p.address || '');
    setPatientSearchQuery(`${p.firstName} ${p.lastName} (${p.patientId})`);
    setPatientSearchResults([p]);
    setShowSearchResults(false);
    setFormError('');
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.status === 'Booked') {
      setFormError(`The ${slot.time} slot is already booked for this doctor. Please select an available slot.`);
      return;
    }
    setFormError('');
    setAppointmentTime(slot.time);
  };

  const handleDateShift = (days: number) => {
    const d = new Date(appointmentDate);
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split('T')[0];
    setAppointmentDate(newDateStr);
  };

  const formatDateForDisplay = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[parseInt(month, 10) - 1]} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatDateForSummary = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const currentDept = departments.find((d) => d.id === selectedDeptId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Please search and select an existing patient or enter First Name and Last Name.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Please provide a contact phone number.');
      return;
    }
    if (!dob) {
      setFormError('Please provide patient date of birth.');
      return;
    }
    if (!selectedDoctorId) {
      setFormError('Please select a doctor.');
      return;
    }
    if (!appointmentDate || !appointmentTime) {
      setFormError('Please select an appointment date and time slot.');
      return;
    }

    setIsSubmitting(true);
    try {
      let patientIdToBook = selectedPatientId;

      // If this is a new patient not yet saved, create patient record first
      if (!patientIdToBook) {
        const createdPatient = await patientService.create({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob: dob || '2000-01-01',
          gender: (gender as Gender) || 'Male',
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim() || 'Standard Registered Address',
        });
        patientIdToBook = createdPatient.id;
      }

      await appointmentService.createAppointment({
        patientId: patientIdToBook,
        doctorId: selectedDoctorId,
        departmentId: selectedDeptId,
        appointmentDate,
        appointmentTime,
        durationMinutes,
        appointmentType,
        reasonForVisit: reasonForVisit.trim() || 'General Consultation',
      });

      onAppointmentCreated();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create appointment.');
      onError(err?.message || 'Failed to create appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-body animate-fade-in">
      <form onSubmit={handleSubmit}>
        <div className="new-appointment-layout">
          {/* ================= LEFT FORM COLUMN ================= */}
          <div className="form-column">
            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 12,
                  color: '#be123c',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={18} />
                <span>{formError}</span>
              </div>
            )}

            {/* SECTION 1: PATIENT INFORMATION */}
            <div className="form-section-card">
              <div className="form-section-header">
                <div className="form-section-title-wrap">
                  <div className="section-number-badge">1</div>
                  <h2 className="section-title-text">Patient Information</h2>
                </div>
                <div style={{ opacity: 0.15 }}>
                  <Sparkles size={28} color="#4f46e5" />
                </div>
              </div>

              {/* Search Patient Bar */}
              <div className="patient-search-row">
                <div className="patient-search-input-wrap">
                  <label className="form-label" style={{ marginBottom: 6 }}>
                    Search Patient <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Search size={16} className="form-input-icon" />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search by Patient ID, Name or Phone number..."
                      value={patientSearchQuery}
                      onChange={(e) => handlePatientSearchChange(e.target.value)}
                      onFocus={() => {
                        if (patientSearchResults.length > 0) setShowSearchResults(true);
                      }}
                    />
                  </div>

                  {/* Dropdown Auto-complete list */}
                  {showSearchResults && (
                    <div className="patient-search-dropdown">
                      {isSearchingPatient ? (
                        <div style={{ padding: 12, color: '#64748b', fontSize: '0.84375rem' }}>Searching patients...</div>
                      ) : patientSearchResults.length === 0 ? (
                        <div style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '0.84375rem' }}>
                          <p style={{ margin: '0 0 8px 0' }}>No patient matches found.</p>
                          <button
                            type="button"
                            onClick={handleNewPatientClick}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={14} /> + New Patient
                          </button>
                        </div>
                      ) : (
                        patientSearchResults.map((pat) => (
                          <div
                            key={pat.id}
                            className="patient-search-item"
                            onClick={() => applyPatient(pat)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img
                                src={pat.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                                alt={pat.firstName}
                                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                              />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                                  {pat.firstName} {pat.lastName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  ID: {pat.patientId} | Tel: {pat.phone}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600 }}>Select</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: 24 }}>
                  <button
                    type="button"
                    className="btn-new-patient"
                    onClick={handleNewPatientClick}
                  >
                    <Plus size={16} />
                    <span>New Patient</span>
                  </button>
                </div>
              </div>

              {/* Patient Fields Grid */}
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">
                    Patient ID <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <User size={15} className="form-input-icon" />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Auto-generated upon save"
                      value={patientIdCode}
                      readOnly
                      style={{ backgroundColor: '#f8fafc', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    First Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input no-icon"
                    placeholder="e.g. David"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Last Name <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input no-icon"
                    placeholder="e.g. Miller"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">
                    Date of Birth <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Calendar size={15} className="form-input-icon" />
                    <input
                      type="date"
                      className="form-input"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Gender <span className="required-star">*</span>
                  </label>
                  <select
                    className="form-select no-icon"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Phone Number <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Phone size={15} className="form-input-icon" />
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <div className="form-input-box">
                    <Mail size={15} className="form-input-icon" />
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. patient@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <div className="form-input-box">
                    <MapPin size={15} className="form-input-icon" />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 25, Green Street, City"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: APPOINTMENT DETAILS */}
            <div className="form-section-card">
              <div className="form-section-header">
                <div className="form-section-title-wrap">
                  <div className="section-number-badge">2</div>
                  <h2 className="section-title-text">Appointment Details</h2>
                </div>
              </div>

              <div className="form-grid-3">
                {/* Department */}
                <div className="form-group">
                  <label className="form-label">
                    Department <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Building2 size={15} className="form-input-icon" color="#2563eb" />
                    <select
                      className="form-select"
                      value={selectedDeptId}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                    >
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Doctor */}
                <div className="form-group">
                  <label className="form-label">
                    Doctor <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Stethoscope size={15} className="form-input-icon" color="#2563eb" />
                    <select
                      className="form-select"
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                    >
                      {filteredDoctors.length === 0 ? (
                        <option value="">No doctors available today</option>
                      ) : (
                        filteredDoctors.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} ({doc.workingHours?.start} - {doc.workingHours?.end})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Appointment Type */}
                <div className="form-group">
                  <label className="form-label">
                    Appointment Type <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Clock size={15} className="form-input-icon" color="#2563eb" />
                    <select
                      className="form-select"
                      value={appointmentType}
                      onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
                    >
                      <option value="Consultation">Consultation</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Routine Checkup">Routine Checkup</option>
                      <option value="Specialist Consultation">Specialist Consultation</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-grid-3">
                {/* Appointment Date */}
                <div className="form-group">
                  <label className="form-label">
                    Appointment Date <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Calendar size={15} className="form-input-icon" color="#2563eb" />
                    <input
                      type="date"
                      className="form-input"
                      value={appointmentDate}
                      min="2024-05-01"
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Appointment Time */}
                <div className="form-group">
                  <label className="form-label">
                    Appointment Time <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Clock size={15} className="form-input-icon" color="#2563eb" />
                    <input
                      type="text"
                      className="form-input"
                      value={appointmentTime}
                      readOnly
                      style={{ cursor: 'pointer', backgroundColor: '#f8fafc', fontWeight: 600 }}
                      placeholder="Select a slot from right"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="form-group">
                  <label className="form-label">
                    Duration <span className="required-star">*</span>
                  </label>
                  <div className="form-input-box">
                    <Clock size={15} className="form-input-icon" color="#2563eb" />
                    <select
                      className="form-select"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Reason for Visit */}
              <div className="form-group">
                <label className="form-label">
                  Reason for Visit
                </label>
                <div className="form-input-box">
                  <FileText size={16} className="form-input-icon" style={{ top: 18 }} />
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Regular check-up and consultation..."
                    value={reasonForVisit}
                    onChange={(e) => setReasonForVisit(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-bottom-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onCancel}
                >
                  <XCircle size={16} />
                  <span>Cancel</span>
                </button>

                <button
                  type="submit"
                  className="btn-create-apt"
                  disabled={isSubmitting}
                >
                  <CalendarPlus size={16} />
                  <span>{isSubmitting ? 'Creating...' : 'Create Appointment'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: SUMMARY & AVAILABILITY ================= */}
          <div className="summary-column">
            {/* 1. Appointment Summary Card */}
            <div className="summary-card">
              <div className="summary-card-header">
                <div className="summary-title-wrap">
                  <Calendar size={18} color="#2563eb" />
                  <span>Appointment Summary</span>
                </div>
                <div className="summary-status-pill">
                  <CheckCircle size={16} />
                </div>
              </div>

              <div className="summary-rows-list">
                <div className="summary-row">
                  <div className="summary-row-label">
                    <User size={15} /> Patient
                  </div>
                  <div className="summary-row-val">
                    {firstName || lastName
                      ? `${firstName} ${lastName}${patientIdCode ? ` (${patientIdCode})` : ' (New)'}`.trim()
                      : 'Not Selected'}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Stethoscope size={15} /> Doctor
                  </div>
                  <div className="summary-row-val">
                    {currentDoctor?.name || 'Not Selected'}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Building2 size={15} /> Department
                  </div>
                  <div className="summary-row-val">
                    {currentDept?.name || 'Not Selected'}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Calendar size={15} /> Date
                  </div>
                  <div className="summary-row-val">
                    {formatDateForSummary(appointmentDate)}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Clock size={15} /> Time
                  </div>
                  <div className="summary-row-val" style={{ color: '#2563eb' }}>
                    {appointmentTime || 'Select Time'}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <FileText size={15} /> Type
                  </div>
                  <div className="summary-row-val">{appointmentType}</div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Clock size={15} /> Duration
                  </div>
                  <div className="summary-row-val">{durationMinutes} Minutes</div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <FileText size={15} /> Reason
                  </div>
                  <div className="summary-row-val" style={{ fontSize: '0.8125rem' }}>
                    {reasonForVisit || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Doctor Availability Card */}
            <div className="availability-card">
              <div className="availability-header">
                <div className="availability-title">
                  <Calendar size={18} color="#2563eb" />
                  <span>Doctor Availability</span>
                </div>

                <div className="availability-date-nav">
                  <span>{formatDateForDisplay(appointmentDate)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="nav-arrow-btn"
                      onClick={() => handleDateShift(-1)}
                      title="Previous Day"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="nav-arrow-btn"
                      onClick={() => handleDateShift(1)}
                      title="Next Day"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Slot Items */}
              <div className="time-slots-list">
                {timeSlots.map((slot) => {
                  const isSelected = slot.time === appointmentTime;
                  const isBooked = slot.status === 'Booked';

                  return (
                    <div
                      key={slot.time}
                      className={`time-slot-item ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSlotClick(slot)}
                    >
                      <span>{slot.time}</span>

                      {isSelected ? (
                        <span className="slot-badge selected">
                          Selected ✓
                        </span>
                      ) : isBooked ? (
                        <span className="slot-badge booked">
                          Booked
                        </span>
                      ) : (
                        <span className="slot-badge available">
                          Available
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* New Patient Registration Modal (Local Fallback & Direct Trigger) */}
      <NewPatientModal
        isOpen={isLocalPatientModalOpen}
        onClose={() => setIsLocalPatientModalOpen(false)}
        onPatientCreated={handlePatientCreatedLocal}
      />
    </div>
  );
};
