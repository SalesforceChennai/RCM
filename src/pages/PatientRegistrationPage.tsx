import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  HeartHandshake,
  Search,
  Info,
  AlertCircle,
  Clock,
  ArrowRight,
  Save,
  Building2,
  Stethoscope,
  Sparkles,
  FileCheck,
  UserCheck
} from 'lucide-react';
import type { Patient, RegistrationStatus, IdType, Gender, Appointment } from '../types';
import { patientService } from '../services/patientService';
import { registrationService, type RegistrationSearchResult } from '../services/registrationService';
import { storageService } from '../services/storageService';

interface PatientRegistrationPageProps {
  preselectedPatientId?: string | null;
  onNavigateToInsurance: (patientId: string) => void;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const PatientRegistrationPage: React.FC<PatientRegistrationPageProps> = ({
  preselectedPatientId,
  onNavigateToInsurance,
  onCancel,
  onSuccess,
  onError,
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RegistrationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Active Selected Patient & Appointment
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [latestAppointment, setLatestAppointment] = useState<Appointment | null>(null);

  // Form Fields: Personal Info
  const [patientIdCode, setPatientIdCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Form Fields: Identification Info
  const [idType, setIdType] = useState<IdType>('National ID');
  const [idNumber, setIdNumber] = useState('');

  // Form Fields: Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('Spouse');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Form Fields: Registration Details
  const [registrationDate, setRegistrationDate] = useState('2024-05-31');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>('Registered');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // On mount: if preselectedPatientId passed, load it
  useEffect(() => {
    if (preselectedPatientId) {
      loadPatientById(preselectedPatientId);
    } else {
      // Default to first patient in storage for convenient instant inspection
      const patients = storageService.getPatients();
      if (patients.length > 0) {
        loadPatientById(patients[0].id);
      }
    }
  }, [preselectedPatientId]);

  const loadPatientById = async (patId: string) => {
    try {
      const patient = await patientService.getById(patId);
      if (patient) {
        applyPatientData(patient);
      }
    } catch {
      onError('Failed to load patient profile.');
    }
  };

  const applyPatientData = async (pat: Patient, appt?: Appointment | null) => {
    setSelectedPatient(pat);
    setPatientIdCode(pat.patientId || '');
    setFirstName(pat.firstName || '');
    setLastName(pat.lastName || '');
    setDob(pat.dob || '');
    setGender(pat.gender || 'Male');
    setPhone(pat.phone || '');
    setEmail(pat.email || '');
    setAddress(pat.address || '');

    // Check existing registration
    const existingReg = await registrationService.getRegistration(pat.id);
    if (existingReg) {
      setIdType(existingReg.idType || 'National ID');
      setIdNumber(existingReg.idNumber || '');
      setEmergencyContactName(existingReg.emergencyContactName || '');
      setEmergencyContactRelationship(existingReg.emergencyContactRelationship || 'Spouse');
      setEmergencyContactPhone(existingReg.emergencyContactPhone || '');
      setRegistrationDate(existingReg.registrationDate || '2024-05-31');
      setRegistrationStatus(existingReg.registrationStatus || 'Registered');
      setNotes(existingReg.notes || '');
    } else {
      // Defaults
      setIdType('National ID');
      setIdNumber('');
      setEmergencyContactName(pat.emergencyContact || '');
      setEmergencyContactRelationship('Family');
      setEmergencyContactPhone(pat.phone || '');
      setRegistrationDate('2024-05-31');
      setRegistrationStatus('Registered');
      setNotes('');
    }

    // Appointment info
    if (appt) {
      setLatestAppointment(appt);
    } else {
      const allAppts = storageService.getAppointments();
      const match = allAppts.find((a) => a.patientId === pat.id);
      setLatestAppointment(match || null);
    }

    setSearchQuery(`${pat.firstName} ${pat.lastName} (${pat.patientId})`);
    setShowSearchResults(false);
  };

  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await registrationService.searchPatientsForRegistration(query);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: RegistrationSearchResult) => {
    applyPatientData(result.patient, result.appointment);
  };

  const handleSaveRegistration = async (goToInsurance: boolean = false) => {
    setFormError('');
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Please provide patient First Name and Last Name.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Please provide a valid contact Phone Number.');
      return;
    }
    if (!idNumber.trim()) {
      setFormError('Please provide an Identification / Document Number.');
      return;
    }
    if (!emergencyContactName.trim() || !emergencyContactPhone.trim()) {
      setFormError('Please provide Emergency Contact Person Name and Phone Number.');
      return;
    }

    setIsSaving(true);
    try {
      let patientIdToUse = selectedPatient?.id;

      // 1. Update or create patient record
      if (selectedPatient) {
        await patientService.update(selectedPatient.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob,
          gender: (gender as Gender) || 'Male',
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          emergencyContact: emergencyContactName.trim()
        });
      } else {
        const created = await patientService.create({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dob: dob || '2000-01-01',
          gender: (gender as Gender) || 'Male',
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim() || 'Not provided',
          emergencyContact: emergencyContactName.trim()
        });
        patientIdToUse = created.id;
        setSelectedPatient(created);
        setPatientIdCode(created.patientId);
      }

      if (!patientIdToUse) {
        throw new Error('Could not identify patient ID to save registration.');
      }

      // 2. Save Patient Registration Record
      const savedReg = await registrationService.saveRegistration({
        patientId: patientIdToUse,
        appointmentId: latestAppointment?.id,
        idType,
        idNumber: idNumber.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactRelationship,
        emergencyContactPhone: emergencyContactPhone.trim(),
        registrationDate,
        registrationStatus,
        notes: notes.trim()
      });

      onSuccess(`Patient Registration saved successfully with status: ${savedReg.registrationStatus}`);

      if (goToInsurance) {
        onNavigateToInsurance(patientIdToUse);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save patient registration.');
      onError(err?.message || 'Failed to save registration.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadgeStyle = (st: RegistrationStatus) => {
    switch (st) {
      case 'Verified':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'Registered':
        return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
      default:
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
    }
  };

  const badgeColors = getStatusBadgeStyle(registrationStatus);

  return (
    <div className="page-body animate-fade-in">
      {/* Top Banner / Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '3px 8px', borderRadius: 4 }}>
              Module 2
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Revenue Cycle Management</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Patient Registration & Intake
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Verify patient identity, capture government ID, emergency contact, and register arrivals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleSaveRegistration(false)}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Registration'}</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleSaveRegistration(true)}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#059669' }}
          >
            <span>Continue to Insurance</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {formError && (
        <div className="error-banner" style={{ marginBottom: 20 }}>
          <AlertCircle size={18} />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="form-main-layout">
        {/* Left Column: Registration Form */}
        <div className="form-column">
          {/* SECTION 1: SEARCH & PATIENT LOOKUP */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge">1</div>
                <h2 className="section-title-text">Search Patient / Appointment</h2>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Lookup by Patient ID, Name, Phone Number, or Appointment Code
                </label>
                <div className="form-input-box">
                  <Search size={16} className="form-input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Type Patient ID (e.g. P10023), Name, Phone, or Appointment (e.g. APT10001)..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.trim()) setShowSearchResults(true);
                    }}
                  />
                </div>
              </div>

              {/* In-Flow Search Loading Indicator */}
              {showSearchResults && isSearching && (
                <div
                  className="animate-fade-in"
                  style={{
                    marginTop: 14,
                    padding: '14px 16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    color: '#64748b',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <Search size={16} className="animate-spin" color="#4f46e5" />
                  <span>Searching patient database...</span>
                </div>
              )}

              {/* In-Flow Matching Patient Cards - Expands Section 1 and pushes Section 2 downward */}
              {showSearchResults && !isSearching && searchResults.length > 0 && (
                <div
                  className="animate-fade-in"
                  style={{
                    marginTop: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 2 }}>
                    Matching Patient Records ({searchResults.length}) — Click a patient to select:
                  </div>

                  {searchResults.map((res: RegistrationSearchResult) => (
                    <div
                      key={res.patient.id}
                      onClick={() => handleSelectSearchResult(res)}
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        flexWrap: 'wrap',
                        gap: 12
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#4f46e5';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260, flex: 1 }}>
                        <img
                          src={res.patient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                          alt={res.patient.firstName}
                          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #cbd5e1' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                            {res.patient.firstName} {res.patient.lastName}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span>Patient ID: <strong style={{ color: '#4f46e5' }}>{res.patient.patientId}</strong></span>
                            <span>•</span>
                            <span>Tel: <strong>{res.patient.phone}</strong></span>
                            <span>•</span>
                            <span>DOB: {res.patient.dob}</span>
                            {res.appointment && (
                              <>
                                <span>•</span>
                                <span style={{ color: '#059669', fontWeight: 600 }}>
                                  Appt: {res.appointment.appointmentCode} ({res.appointment.appointmentDate} at {res.appointment.appointmentTime})
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {res.registration ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontWeight: 700,
                              ...getStatusBadgeStyle(res.registration.registrationStatus)
                            }}
                          >
                            {res.registration.registrationStatus}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontWeight: 600,
                              backgroundColor: '#f1f5f9',
                              color: '#64748b',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            Unregistered
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: '0.8125rem',
                            color: '#ffffff',
                            backgroundColor: '#4f46e5',
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontWeight: 600,
                            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
                          }}
                        >
                          Select Patient
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* In-flow message directly below search input when no results exist */}
              {searchQuery.trim() !== '' && !isSearching && searchResults.length === 0 && (
                <div
                  className="animate-fade-in"
                  style={{
                    marginTop: 14,
                    padding: '14px 16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    color: '#475569',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    lineHeight: 1.4
                  }}
                >
                  <Info size={18} color="#64748b" style={{ flexShrink: 0 }} />
                  <span>No matching patients found. You can enter details manually below.</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: PERSONAL INFORMATION */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge">2</div>
                <h2 className="section-title-text">Personal Information</h2>
              </div>
            </div>

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
                    placeholder="Auto-assigned upon save"
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
                  placeholder="e.g. Rahul"
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
                  placeholder="e.g. Kumar"
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
                  required
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
                <label className="form-label">Email Address</label>
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
                <label className="form-label">Residential Address</label>
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

          {/* SECTION 3: IDENTIFICATION INFORMATION */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge">3</div>
                <h2 className="section-title-text">Identification Information</h2>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Government ID Type <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <CreditCard size={15} className="form-input-icon" color="#2563eb" />
                  <select
                    className="form-select"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as IdType)}
                  >
                    <option value="National ID">National ID (Aadhaar / SSN / Voter ID)</option>
                    <option value="Driver License">Driver's License</option>
                    <option value="Passport">Passport</option>
                    <option value="State ID">State Issued ID</option>
                    <option value="Social Security Card">Social Security Card</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  ID / Document Number <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input no-icon"
                  placeholder="e.g. NID-99281-0023 or DL-TN02-2018"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: EMERGENCY CONTACT */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge">4</div>
                <h2 className="section-title-text">Emergency Contact</h2>
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">
                  Contact Person Name <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <HeartHandshake size={15} className="form-input-icon" color="#2563eb" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ramesh Kumar"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Relationship to Patient</label>
                <select
                  className="form-select no-icon"
                  value={emergencyContactRelationship}
                  onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Sibling">Sibling / Brother / Sister</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Friend">Friend / Relative</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Contact Number <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <Phone size={15} className="form-input-icon" color="#2563eb" />
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +91 98765 00001"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: REGISTRATION STATUS & DETAILS */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge">5</div>
                <h2 className="section-title-text">Registration Details & Notes</h2>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Registration Date <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <Calendar size={15} className="form-input-icon" />
                  <input
                    type="date"
                    className="form-input"
                    value={registrationDate}
                    onChange={(e) => setRegistrationDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Registration Status <span className="required-star">*</span>
                </label>
                <select
                  className="form-select no-icon"
                  value={registrationStatus}
                  onChange={(e) => setRegistrationStatus(e.target.value as RegistrationStatus)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="Pending">Pending (Awaiting Intake)</option>
                  <option value="Registered">Registered (Intake Completed)</option>
                  <option value="Verified">Verified (Govt ID & Biometrics Confirmed)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Staff Notes / Intake Comments</label>
              <textarea
                className="form-input no-icon"
                rows={2}
                placeholder="e.g. Patient checked in at reception desk, verified identity document, and completed demographic consent forms."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Registration Summary & Linked Appointment */}
        <div className="summary-column">
          {/* Summary Card */}
          <div className="summary-card">
            <div className="summary-card-header">
              <div className="summary-title-wrap">
                <UserCheck size={18} color="#2563eb" />
                <span>Registration Summary</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: badgeColors.bg,
                  color: badgeColors.text,
                  border: `1px solid ${badgeColors.border}`
                }}
              >
                {registrationStatus}
              </span>
            </div>

            <div className="summary-rows-list">
              <div className="summary-row">
                <div className="summary-row-label">
                  <User size={15} /> Patient
                </div>
                <div className="summary-row-val">
                  {firstName || lastName
                    ? `${firstName} ${lastName}${patientIdCode ? ` (${patientIdCode})` : ''}`
                    : 'Not Selected'}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <Phone size={15} /> Contact
                </div>
                <div className="summary-row-val">{phone || 'N/A'}</div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <CreditCard size={15} /> ID Type
                </div>
                <div className="summary-row-val">{idType}</div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <FileCheck size={15} /> ID Number
                </div>
                <div className="summary-row-val" style={{ fontWeight: 600, color: '#0f172a' }}>
                  {idNumber || 'Pending Entry'}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <HeartHandshake size={15} /> Emergency
                </div>
                <div className="summary-row-val" style={{ fontSize: '0.8125rem' }}>
                  {emergencyContactName ? `${emergencyContactName} (${emergencyContactRelationship})` : 'Not Provided'}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <Calendar size={15} /> Reg Date
                </div>
                <div className="summary-row-val">{registrationDate}</div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSaveRegistration(false)}
                disabled={isSaving}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Save size={16} />
                <span>{isSaving ? 'Saving...' : 'Save Registration'}</span>
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => handleSaveRegistration(true)}
                disabled={isSaving}
                style={{ width: '100%', justifyContent: 'center', backgroundColor: '#059669' }}
              >
                <span>Continue to Insurance Verification</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Linked Appointment Card */}
          {latestAppointment && (
            <div className="summary-card" style={{ marginTop: 16 }}>
              <div className="summary-card-header">
                <div className="summary-title-wrap">
                  <Calendar size={18} color="#2563eb" />
                  <span>Linked Appointment</span>
                </div>
                <span className="summary-status-pill">
                  {latestAppointment.status}
                </span>
              </div>

              <div className="summary-rows-list">
                <div className="summary-row">
                  <div className="summary-row-label">
                    <Sparkles size={15} /> Code
                  </div>
                  <div className="summary-row-val" style={{ fontWeight: 700, color: '#4f46e5' }}>
                    {latestAppointment.appointmentCode}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Stethoscope size={15} /> Doctor
                  </div>
                  <div className="summary-row-val">{latestAppointment.doctor.name}</div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Building2 size={15} /> Department
                  </div>
                  <div className="summary-row-val">{latestAppointment.departmentName}</div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Calendar size={15} /> Date & Time
                  </div>
                  <div className="summary-row-val" style={{ color: '#2563eb', fontWeight: 600 }}>
                    {latestAppointment.appointmentDate} at {latestAppointment.appointmentTime}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Clock size={15} /> Reason
                  </div>
                  <div className="summary-row-val" style={{ fontSize: '0.8125rem' }}>
                    {latestAppointment.reasonForVisit}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
