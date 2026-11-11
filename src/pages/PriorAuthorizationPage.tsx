import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  User,
  ShieldCheck,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Save,
  RefreshCw,
  Stethoscope,
  FileText,
  Paperclip,
  Check,
  Edit,
  Eye,
  Plus,
  SlidersHorizontal,
  Activity,
  AlertTriangle
} from 'lucide-react';
import type {
  Patient,
  Appointment,
  PatientRegistration,
  InsuranceInfo,
  PriorAuthorization,
  PriorAuthStatus,
  Doctor,
  Department
} from '../types';
import { patientService } from '../services/patientService';
import { storageService } from '../services/storageService';
import {
  priorAuthService,
  PROCEDURE_PRESETS,
  type PriorAuthSearchResult,
  type ProcedurePreset
} from '../services/priorAuthService';
import { doctorService } from '../services/doctorService';
import { departmentService } from '../services/departmentService';

interface PriorAuthorizationPageProps {
  preselectedPatientId?: string | null;
  onNavigateToChargeCapture?: (patientId: string) => void;
  onNavigateToDashboard: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const PriorAuthorizationPage: React.FC<PriorAuthorizationPageProps> = ({
  preselectedPatientId,
  onNavigateToChargeCapture,
  onNavigateToDashboard,
  onSuccess,
  onError,
}) => {
  // Reference Data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PriorAuthSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Selected Patient Context
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [linkedRegistration, setLinkedRegistration] = useState<PatientRegistration | null>(null);
  const [linkedAppointment, setLinkedAppointment] = useState<Appointment | null>(null);
  const [linkedInsurance, setLinkedInsurance] = useState<InsuranceInfo | null>(null);

  // Step 2 & 3: Service & Requirement Form State
  const [serviceName, setServiceName] = useState('');
  const [procedureCode, setProcedureCode] = useState('');
  const [diagnosisCode, setDiagnosisCode] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [medicalJustification, setMedicalJustification] = useState('');
  const [authorizationRequired, setAuthorizationRequired] = useState<boolean>(false);

  // Step 4: Prior Auth Request Form State
  const [authRequestId, setAuthRequestId] = useState('PA-10001');
  const [requestDate, setRequestDate] = useState('');
  const [supportingDocs, setSupportingDocs] = useState<string[]>([]);
  const [customDocInput, setCustomDocInput] = useState('');
  const [editingAuthId, setEditingAuthId] = useState<string | null>(null);

  // Active Result State
  const [activeAuthResult, setActiveAuthResult] = useState<PriorAuthorization | null>(null);

  // Table Management State
  const [allAuthorizations, setAllAuthorizations] = useState<PriorAuthorization[]>([]);
  const [tableFilterStatus, setTableFilterStatus] = useState<PriorAuthStatus | 'All'>('All');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Modals
  const [viewingAuth, setViewingAuth] = useState<PriorAuthorization | null>(null);
  const [statusModalAuth, setStatusModalAuth] = useState<PriorAuthorization | null>(null);
  const [statusModalTargetStatus, setStatusModalTargetStatus] = useState<PriorAuthStatus>('Approved');
  const [statusModalAuthNum, setStatusModalAuthNum] = useState('');
  const [statusModalValidFrom, setStatusModalValidFrom] = useState('');
  const [statusModalValidUntil, setStatusModalValidUntil] = useState('');
  const [statusModalDenialReason, setStatusModalDenialReason] = useState('');
  const [statusModalSuggestedAction, setStatusModalSuggestedAction] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Initial Reference Data & Storage Load
  useEffect(() => {
    const init = async () => {
      const [docs, depts, auths] = await Promise.all([
        doctorService.getAll(),
        departmentService.getAll(),
        priorAuthService.getAll(),
      ]);
      setDoctors(docs);
      setDepartments(depts);
      setAllAuthorizations(auths);
      setAuthRequestId(priorAuthService.generateNextRequestId());
      setRequestDate(storageService.getCurrentDate());

      if (preselectedPatientId) {
        loadPatientContext(preselectedPatientId);
      }
    };
    init();
  }, [preselectedPatientId]);

  const refreshAuthorizationsList = async () => {
    const list = await priorAuthService.getAll();
    setAllAuthorizations(list);
  };

  // 2. Load Patient Context
  const loadPatientContext = async (patientId: string) => {
    try {
      const patient = await patientService.getById(patientId);
      if (patient) {
        applyPatientData(patient);
      }
    } catch {
      onError('Failed to load patient profile for prior authorization.');
    }
  };

  const applyPatientData = (
    patient: Patient,
    appt?: Appointment | null,
    reg?: PatientRegistration | null,
    ins?: InsuranceInfo | null,
    existingAuths?: PriorAuthorization[]
  ) => {
    setSelectedPatient(patient);
    setSearchQuery(`${patient.firstName} ${patient.lastName} (${patient.patientId})`);
    setShowSearchResults(false);

    // Linked Reg
    const patientReg = reg !== undefined ? reg : storageService.getRegistrationByPatientId(patient.id);
    setLinkedRegistration(patientReg);

    // Linked Appt
    if (appt !== undefined) {
      setLinkedAppointment(appt);
    } else {
      const allAppts = storageService.getAppointments();
      const match = allAppts.find((a) => a.patientId === patient.id);
      setLinkedAppointment(match || null);
    }

    // Linked Insurance
    const patientIns = ins !== undefined ? ins : storageService.getInsuranceByPatientId(patient.id);
    setLinkedInsurance(patientIns);

    // Find any existing prior auth for this patient
    const auths = existingAuths !== undefined ? existingAuths : storageService.getPriorAuthByPatientId(patient.id);
    if (auths.length > 0) {
      const latest = auths[auths.length - 1];
      setActiveAuthResult(latest);
    } else {
      setActiveAuthResult(null);
    }
  };

  // 3. Autocomplete Search
  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const res = await priorAuthService.searchPatientsForPriorAuth(val);
      setSearchResults(res);
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (res: PriorAuthSearchResult) => {
    applyPatientData(res.patient, res.appointment, res.registration, res.insurance, res.authorizations);
    setShowSearchResults(false);
  };

  // 4. Procedure Preset Selection
  const handleApplyPreset = (preset: ProcedurePreset) => {
    setServiceName(preset.name);
    setProcedureCode(preset.procedureCode);
    setDiagnosisCode(preset.diagnosisCode);
    setSelectedDeptId(preset.departmentId);
    setEstimatedCost(preset.estimatedCost);
    setAuthorizationRequired(preset.authorizationRequired);
    setMedicalJustification(preset.medicalJustification);
    setSupportingDocs(preset.supportingDocuments);

    // Match doctor in that department if possible
    const matchDoc = doctors.find((d) => d.departmentId === preset.departmentId);
    if (matchDoc) {
      setSelectedDoctorId(matchDoc.id);
    }
  };

  // 5. Toggle Document Checkbox
  const handleToggleDoc = (docName: string) => {
    if (supportingDocs.includes(docName)) {
      setSupportingDocs(supportingDocs.filter((d) => d !== docName));
    } else {
      setSupportingDocs([...supportingDocs, docName]);
    }
  };

  const handleAddCustomDoc = () => {
    if (!customDocInput.trim()) return;
    if (!supportingDocs.includes(customDocInput.trim())) {
      setSupportingDocs([...supportingDocs, customDocInput.trim()]);
    }
    setCustomDocInput('');
  };

  // 6. Submit Authorization Request / Save Not Required
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPatient) {
      setFormError('Please search and select a patient first.');
      return;
    }

    if (!serviceName.trim()) {
      setFormError('Service / Procedure Name is required.');
      return;
    }

    if (!medicalJustification.trim()) {
      setFormError('Medical reason / clinical justification is required for authorization.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedDoc = doctors.find((d) => d.id === selectedDoctorId);
      const selectedDept = departments.find((d) => d.id === selectedDeptId);
      const payerName = linkedInsurance?.insuranceProvider || 'Standard Health Insurance';
      const memId = linkedInsurance?.memberId || 'N/A';
      const polNum = linkedInsurance?.policyNumber || 'N/A';

      if (!authorizationRequired) {
        // Save as Not Required
        const newRecord: Omit<PriorAuthorization, 'id' | 'createdAt' | 'updatedAt'> = {
          authorizationRequestId: editingAuthId ? authRequestId : priorAuthService.generateNextRequestId(),
          patientId: selectedPatient.id,
          appointmentId: linkedAppointment?.id,
          serviceName,
          procedureCode,
          diagnosisCode,
          doctorId: selectedDoctorId,
          doctorName: selectedDoc?.name,
          departmentId: selectedDeptId,
          departmentName: selectedDept?.name,
          insuranceProvider: payerName,
          memberId: memId,
          policyNumber: polNum,
          requestDate,
          serviceDate,
          estimatedCost,
          medicalJustification,
          supportingDocuments: supportingDocs,
          authorizationRequired: false,
          status: 'Not Required',
          notes: 'Service pre-cleared under active insurance guidelines without requiring Prior Authorization submission.'
        };

        let saved: PriorAuthorization;
        if (editingAuthId) {
          saved = await priorAuthService.update(editingAuthId, newRecord);
          setEditingAuthId(null);
        } else {
          saved = await priorAuthService.create(newRecord);
        }

        setActiveAuthResult(saved);
        await refreshAuthorizationsList();
        onSuccess(`Service saved: No Prior Authorization Required for ${serviceName}.`);
      } else {
        // Save as Pending (or preserve status if editing)
        const currentExisting = editingAuthId ? storageService.getPriorAuthById(editingAuthId) : null;
        const initialStatus: PriorAuthStatus = currentExisting?.status || 'Pending';

        const newRecord: Omit<PriorAuthorization, 'id' | 'createdAt' | 'updatedAt'> = {
          authorizationRequestId: editingAuthId ? authRequestId : priorAuthService.generateNextRequestId(),
          patientId: selectedPatient.id,
          appointmentId: linkedAppointment?.id,
          serviceName,
          procedureCode,
          diagnosisCode,
          doctorId: selectedDoctorId,
          doctorName: selectedDoc?.name,
          departmentId: selectedDeptId,
          departmentName: selectedDept?.name,
          insuranceProvider: payerName,
          memberId: memId,
          policyNumber: polNum,
          requestDate,
          serviceDate,
          estimatedCost,
          medicalJustification,
          supportingDocuments: supportingDocs,
          authorizationRequired: true,
          status: initialStatus,
          authorizationNumber: currentExisting?.authorizationNumber,
          approvedDate: currentExisting?.approvedDate,
          validFrom: currentExisting?.validFrom,
          validUntil: currentExisting?.validUntil,
          denialReason: currentExisting?.denialReason,
          suggestedAction: currentExisting?.suggestedAction,
          notes: currentExisting?.notes || 'Electronic Prior Authorization request (EDI 278) submitted to payer.'
        };

        let saved: PriorAuthorization;
        if (editingAuthId) {
          saved = await priorAuthService.update(editingAuthId, newRecord);
          setEditingAuthId(null);
          onSuccess(`Prior Authorization ${saved.authorizationRequestId} updated successfully!`);
        } else {
          saved = await priorAuthService.create(newRecord);
          onSuccess(`Prior Authorization ${saved.authorizationRequestId} submitted to ${payerName} with status "Pending"!`);
        }

        setActiveAuthResult(saved);
        await refreshAuthorizationsList();
        setAuthRequestId(priorAuthService.generateNextRequestId());
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit authorization request.');
      onError(err?.message || 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Edit Request (loads request into form)
  const handleEditRequest = (auth: PriorAuthorization) => {
    setEditingAuthId(auth.id);
    setAuthRequestId(auth.authorizationRequestId);
    setServiceName(auth.serviceName);
    setProcedureCode(auth.procedureCode);
    setDiagnosisCode(auth.diagnosisCode);
    setSelectedDeptId(auth.departmentId || 'dept-neuro');
    setSelectedDoctorId(auth.doctorId || 'doc-chen');
    setServiceDate(auth.serviceDate || '2024-06-05');
    setRequestDate(auth.requestDate || '2024-05-31');
    setEstimatedCost(auth.estimatedCost || 1500);
    setMedicalJustification(auth.medicalJustification || '');
    setSupportingDocs(auth.supportingDocuments || []);
    setAuthorizationRequired(auth.authorizationRequired);
    setActiveAuthResult(auth);

    // Also select patient
    loadPatientContext(auth.patientId);

    // Scroll to top form smoothly
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // 8. Open Status Modal
  const handleOpenStatusModal = (auth: PriorAuthorization, targetStatus?: PriorAuthStatus) => {
    setStatusModalAuth(auth);
    const initialTarget = targetStatus || (auth.status === 'Pending' ? 'Approved' : auth.status);
    setStatusModalTargetStatus(initialTarget);

    if (initialTarget === 'Approved') {
      setStatusModalAuthNum(auth.authorizationNumber || priorAuthService.generateAuthNumber(auth.insuranceProvider));
      setStatusModalValidFrom(auth.validFrom || storageService.getCurrentDate());
      if (auth.validUntil) {
        setStatusModalValidUntil(auth.validUntil);
      } else {
        const d = new Date(storageService.getCurrentDate());
        d.setMonth(d.getMonth() + 3);
        setStatusModalValidUntil(d.toISOString().split('T')[0]);
      }
    } else if (initialTarget === 'Denied') {
      setStatusModalDenialReason(
        auth.denialReason || 'Clinical documentation does not meet payer medical necessity criteria under standard diagnostic guidelines.'
      );
      setStatusModalSuggestedAction(
        auth.suggestedAction || 'Initiate Peer-to-Peer physician appeal or submit 6-week conservative physical therapy logs.'
      );
    }
  };

  const handleSaveStatusUpdate = async () => {
    if (!statusModalAuth) return;

    try {
      const updated = await priorAuthService.updateStatus(statusModalAuth.id, statusModalTargetStatus, {
        authorizationNumber: statusModalTargetStatus === 'Approved' ? statusModalAuthNum : undefined,
        validFrom: statusModalTargetStatus === 'Approved' ? statusModalValidFrom : undefined,
        validUntil: statusModalTargetStatus === 'Approved' ? statusModalValidUntil : undefined,
        denialReason: statusModalTargetStatus === 'Denied' ? statusModalDenialReason : undefined,
        suggestedAction: statusModalTargetStatus === 'Denied' ? statusModalSuggestedAction : undefined,
      });

      if (activeAuthResult && activeAuthResult.id === updated.id) {
        setActiveAuthResult(updated);
      }

      await refreshAuthorizationsList();
      setStatusModalAuth(null);
      onSuccess(`Authorization ${updated.authorizationRequestId} status updated to "${statusModalTargetStatus}".`);
    } catch (err: any) {
      onError(err?.message || 'Failed to update status.');
    }
  };

  // Helpers for Status Badges
  const getStatusBadgeStyle = (status: PriorAuthStatus) => {
    switch (status) {
      case 'Approved':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac', icon: CheckCircle2 };
      case 'Denied':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', icon: XCircle };
      case 'Pending':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', icon: Clock };
      case 'Not Required':
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: Check };
      case 'Expired':
        return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', icon: AlertTriangle };
      default:
        return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: FileText };
    }
  };

  // Filtered Table Items
  const filteredTableItems = allAuthorizations.filter((item) => {
    const matchesStatus = tableFilterStatus === 'All' || item.status === tableFilterStatus;
    const cleanQ = tableSearchQuery.trim().toLowerCase();
    if (!cleanQ) return matchesStatus;

    const patient = storageService.getPatients().find((p) => p.id === item.patientId);
    const pName = patient ? `${patient.firstName} ${patient.lastName}`.toLowerCase() : '';
    const pCode = patient ? patient.patientId.toLowerCase() : '';

    const matchesSearch =
      item.authorizationRequestId.toLowerCase().includes(cleanQ) ||
      (item.authorizationNumber && item.authorizationNumber.toLowerCase().includes(cleanQ)) ||
      item.serviceName.toLowerCase().includes(cleanQ) ||
      item.procedureCode.toLowerCase().includes(cleanQ) ||
      item.insuranceProvider.toLowerCase().includes(cleanQ) ||
      pName.includes(cleanQ) ||
      pCode.includes(cleanQ);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="page-body animate-fade-in" style={{ paddingBottom: 60 }}>
      {/* Top Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid #bfdbfe'
              }}
            >
              Module 4
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Revenue Cycle Management</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Prior Authorization
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Review services requiring insurance approval and manage authorization requests.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditingAuthId(null);
              setAuthRequestId(priorAuthService.generateNextRequestId());
              window.scrollTo({ top: 180, behavior: 'smooth' });
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#2563eb' }}
          >
            <Plus size={16} />
            <span>New Auth Request</span>
          </button>

          {onNavigateToChargeCapture && selectedPatient && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigateToChargeCapture(selectedPatient.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#059669' }}
            >
              <span>Charge Capture</span>
              <ArrowRight size={16} />
            </button>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={onNavigateToDashboard}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#0f172a' }}
          >
            <span>Return to Dashboard</span>
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

      {/* STEP 1: PATIENT & APPOINTMENT SEARCH SECTION */}
      <div className="form-section-card" style={{ marginBottom: 24 }}>
        <div className="form-section-header">
          <div className="form-section-title-wrap">
            <div className="section-number-badge">1</div>
            <div>
              <h2 className="section-title-text">Search Patient / Appointment</h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                Lookup by Patient ID, Name, Phone Number, or Appointment ID
              </p>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div className="form-input-box">
            <Search size={16} className="form-input-icon" />
            <input
              type="text"
              className="form-input"
              placeholder="Search existing patients (e.g. P10023, Rahul Kumar, 9876543210, APT10001)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim()) setShowSearchResults(true);
              }}
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchResults && (isSearching || searchResults.length > 0) && (
            <div className="patient-search-dropdown animate-fade-in" style={{ zIndex: 100 }}>
              {isSearching ? (
                <div style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.875rem' }}>
                  Searching patient and prior authorization records...
                </div>
              ) : (
                searchResults.map((res: PriorAuthSearchResult) => (
                  <div
                    key={res.patient.id}
                    className="patient-search-item"
                    onClick={() => handleSelectSearchResult(res)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src={res.patient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                        alt={res.patient.firstName}
                        style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                          {res.patient.firstName} {res.patient.lastName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ID: <span style={{ fontWeight: 600, color: '#2563eb' }}>{res.patient.patientId}</span>
                          <span style={{ marginLeft: 8 }}>• Phone: {res.patient.phone}</span>
                          {res.insurance?.insuranceProvider && (
                            <span style={{ marginLeft: 8, color: '#059669', fontWeight: 600 }}>
                              • {res.insurance.insuranceProvider}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {res.authorizations.length > 0 && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            fontWeight: 700
                          }}
                        >
                          {res.authorizations.length} Auth(s)
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                        Select Patient →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 3 Visual Summary Cards: Patient, Appointment, Insurance Information */}
        {selectedPatient ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* PATIENT INFORMATION */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <User size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                  Patient Information
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <img
                  src={selectedPatient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                  alt={selectedPatient.firstName}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a' }}>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </div>
                  <div style={{ fontSize: '0.78125rem', color: '#2563eb', fontWeight: 600 }}>
                    Patient ID: {selectedPatient.patientId}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Date of Birth:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{selectedPatient.dob || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Gender:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{selectedPatient.gender}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Phone Number:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{selectedPatient.phone}</span>
                </div>
                {selectedPatient.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Email:</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{selectedPatient.email}</span>
                  </div>
                )}
                {linkedRegistration && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, paddingTop: 4, borderTop: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Intake Status:</span>
                    <span style={{ fontWeight: 600, color: '#2563eb' }}>
                      {linkedRegistration.registrationStatus} ({linkedRegistration.idType})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* APPOINTMENT INFORMATION */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <Calendar size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                  Appointment Information
                </h3>
              </div>
              {linkedAppointment ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Appointment ID:</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>{linkedAppointment.appointmentCode}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Date & Time:</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {linkedAppointment.appointmentDate} at {linkedAppointment.appointmentTime}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Treating Doctor:</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{linkedAppointment.doctor.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Department:</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{linkedAppointment.departmentName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Type:</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{linkedAppointment.appointmentType}</span>
                  </div>
                  <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Reason for Visit: </span>
                    <span style={{ color: '#334155', fontWeight: 500, fontSize: '0.78125rem' }}>
                      {linkedAppointment.reasonForVisit}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#64748b', fontSize: '0.8125rem' }}>
                  <Stethoscope size={24} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                  <div>No direct appointment linked.</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>You can still create standalone procedure authorization.</div>
                </div>
              )}
            </div>

            {/* INSURANCE INFORMATION */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} color="#7c3aed" />
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                    Insurance Information
                  </h3>
                </div>
                {linkedInsurance && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: linkedInsurance.eligibilityStatus === 'Eligible' ? '#dcfce7' : '#fee2e2',
                      color: linkedInsurance.eligibilityStatus === 'Eligible' ? '#15803d' : '#b91c1c'
                    }}
                  >
                    {linkedInsurance.eligibilityStatus || 'Pending'}
                  </span>
                )}
              </div>

              {linkedInsurance ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Insurance Provider:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{linkedInsurance.insuranceProvider}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Member ID:</span>
                    <span style={{ fontWeight: 600, color: '#7c3aed' }}>{linkedInsurance.memberId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Policy Number:</span>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{linkedInsurance.policyNumber}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Insurance Status:</span>
                    <span style={{ fontWeight: 600, color: linkedInsurance.insuranceStatus === 'Active' ? '#15803d' : '#b91c1c' }}>
                      {linkedInsurance.insuranceStatus}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Verification Status:</span>
                    <span style={{ fontWeight: 600, color: linkedInsurance.verificationResult?.isVerified ? '#15803d' : '#b45309' }}>
                      {linkedInsurance.verificationResult?.isVerified ? '✓ Verified Active' : 'Pending Verification'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#64748b', fontSize: '0.8125rem' }}>
                  <ShieldCheck size={24} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                  <div>No verified insurance profile found.</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Defaulting to standard primary payer protocol.</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
            <User size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '0.9375rem', color: '#475569', fontWeight: 600 }}>No Patient Selected</div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              Search above to automatically populate patient, appointment, and insurance records.
            </div>
          </div>
        )}
      </div>

      {/* MAIN TWO-COLUMN LAYOUT: FORM ON LEFT, RESULT & ACTIVE CONTEXT ON RIGHT */}
      <div className="form-main-layout">
        {/* LEFT COLUMN: PROCEDURE DETAILS, REQUIREMENT TOGGLE, AND PRIOR AUTH REQUEST FORM */}
        <div className="form-column">
          <form onSubmit={handleSubmitRequest}>
            {/* STEP 2: SERVICE / PROCEDURE DETAILS */}
            <div className="form-section-card" style={{ marginBottom: 24 }}>
              <div className="form-section-header">
                <div className="form-section-title-wrap">
                  <div className="section-number-badge">2</div>
                  <div>
                    <h2 className="section-title-text">Service / Procedure Details</h2>
                    <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                      Specify the scheduled clinical procedure, billing codes, and treating specialist
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Template Presets */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SlidersHorizontal size={14} color="#2563eb" />
                  <span>Select Common Procedure Template (Optional):</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PROCEDURE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.78125rem',
                        fontWeight: 600,
                        border: serviceName === preset.name ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: serviceName === preset.name ? '#eff6ff' : '#ffffff',
                        color: serviceName === preset.name ? '#1d4ed8' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {preset.name.split(' ')[0]} {preset.name.split(' ')[1]} ({preset.procedureCode})
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">
                    Service / Procedure Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MRI Scan, Knee Arthroscopy, Cardiac Catheterization"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Procedure Code (CPT / HCPCS)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. CPT 70551, CPT 29881"
                    value={procedureCode}
                    onChange={(e) => setProcedureCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Diagnosis Code (ICD-10)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ICD M54.5, ICD I25.10"
                    value={diagnosisCode}
                    onChange={(e) => setDiagnosisCode(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-3" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Treating Doctor</label>
                  <select
                    className="form-select"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.departmentName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Service Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Estimated Cost ($)</label>
                  <div className="form-input-box">
                    <DollarSign size={15} className="form-input-icon" />
                    <input
                      type="number"
                      className="form-input"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Medical Reason / Clinical Justification <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Enter medical necessity justification, conservative treatments failed, symptoms duration, or relevant clinical indicators..."
                  value={medicalJustification}
                  onChange={(e) => setMedicalJustification(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* STEP 3: AUTHORIZATION REQUIREMENT */}
            <div className="form-section-card" style={{ marginBottom: 24 }}>
              <div className="form-section-header">
                <div className="form-section-title-wrap">
                  <div className="section-number-badge">3</div>
                  <div>
                    <h2 className="section-title-text">Authorization Requirement</h2>
                    <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                      Determine if insurance policy guidelines mandate prior approval for this procedure
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                  Prior Authorization Required?
                </span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: authorizationRequired ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: authorizationRequired ? '#eff6ff' : '#ffffff',
                      color: authorizationRequired ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="authRequired"
                      checked={authorizationRequired === true}
                      onChange={() => setAuthorizationRequired(true)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Yes (Submit Request)</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: !authorizationRequired ? '2px solid #059669' : '1px solid #cbd5e1',
                      backgroundColor: !authorizationRequired ? '#ecfdf5' : '#ffffff',
                      color: !authorizationRequired ? '#047857' : '#475569',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="authRequired"
                      checked={authorizationRequired === false}
                      onChange={() => setAuthorizationRequired(false)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>No (Not Required)</span>
                  </label>
                </div>
              </div>

              {/* If "No" selected */}
              {!authorizationRequired && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={22} color="#059669" />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: '#065f46' }}>
                        No Prior Authorization Required
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#047857' }}>
                        This procedure is pre-cleared for direct clinical scheduling under current payer benefit terms.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isSubmitting}
                      style={{ backgroundColor: '#059669', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <Save size={16} />
                      <span>{isSubmitting ? 'Saving...' : 'Save as Not Required'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 4: CREATE PRIOR AUTHORIZATION REQUEST (If "Yes" selected) */}
            {authorizationRequired && (
              <div className="form-section-card" style={{ marginBottom: 24 }}>
                <div className="form-section-header">
                  <div className="form-section-title-wrap">
                    <div className="section-number-badge">4</div>
                    <div>
                      <h2 className="section-title-text">
                        {editingAuthId ? `Edit Prior Authorization (${authRequestId})` : 'Create Prior Authorization Request'}
                      </h2>
                      <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                        EDI 278 Electronic Prior Authorization submission payload
                      </p>
                    </div>
                  </div>
                </div>

                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Authorization Request ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={authRequestId}
                      readOnly
                      style={{ backgroundColor: '#f1f5f9', fontWeight: 700, color: '#2563eb' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Insurance Provider</label>
                    <input
                      type="text"
                      className="form-input"
                      value={linkedInsurance?.insuranceProvider || 'Blue Cross Blue Shield'}
                      readOnly
                      style={{ backgroundColor: '#f8fafc', color: '#334155' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Patient ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={selectedPatient?.patientId || 'N/A'}
                      readOnly
                      style={{ backgroundColor: '#f8fafc', color: '#334155' }}
                    />
                  </div>
                </div>

                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Appointment ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={linkedAppointment?.appointmentCode || 'N/A'}
                      readOnly
                      style={{ backgroundColor: '#f8fafc', color: '#334155' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Request Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Expected Service Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Supporting Documents */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Paperclip size={15} color="#2563eb" />
                    <span>Supporting Clinical Documents</span>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                    {[
                      'Clinical Notes',
                      'Doctor Referral',
                      'Radiology / Imaging Report',
                      'Lab Results',
                      'Letter of Medical Necessity',
                      'Physical Therapy Records'
                    ].map((docName) => {
                      const isChecked = supportingDocs.includes(docName);
                      return (
                        <label
                          key={docName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: isChecked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                            backgroundColor: isChecked ? '#eff6ff' : '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            color: isChecked ? '#1d4ed8' : '#475569',
                            fontWeight: isChecked ? 600 : 400
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleDoc(docName)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{docName}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Add Custom Document */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Add custom attachment (e.g. EMG Study, Cardiac Echo, Biopsy Report)..."
                      value={customDocInput}
                      onChange={(e) => setCustomDocInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomDoc();
                        }
                      }}
                      style={{ fontSize: '0.8125rem' }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAddCustomDoc}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Plus size={15} /> Add Attachment
                    </button>
                  </div>
                </div>

                {/* Submit Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                  {editingAuthId && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingAuthId(null);
                        setAuthRequestId(priorAuthService.generateNextRequestId());
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#2563eb' }}
                  >
                    <FileCheck2 size={16} />
                    <span>{isSubmitting ? 'Transmitting Request...' : editingAuthId ? 'Save Authorization Changes' : 'Submit Authorization Request'}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* RIGHT COLUMN: AUTHORIZATION RESULT CARD & PATIENT RECENT AUTHS */}
        <div className="summary-column">
          {/* AUTHORIZATION RESULT CARD */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color="#2563eb" />
              <span>Authorization Result</span>
            </h3>

            {activeAuthResult ? (
              activeAuthResult.status === 'Approved' ? (
                /* APPROVED RESULT */
                <div
                  className="summary-card animate-fade-in"
                  style={{
                    border: '1px solid #86efac',
                    background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
                    boxShadow: '0 4px 16px -2px rgba(34, 197, 94, 0.15)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#14532d' }}>
                        ✓ Authorization Approved
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#166534' }}>
                        Request ID: {activeAuthResult.authorizationRequestId}
                      </span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                      Authorization Number
                    </div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#15803d', letterSpacing: '0.02em' }}>
                      {activeAuthResult.authorizationNumber || 'AUTH-APPROVED-001'}
                    </div>
                  </div>

                  <div className="summary-rows-list" style={{ fontSize: '0.8125rem' }}>
                    <div className="summary-row">
                      <span className="summary-row-label">Approved Service:</span>
                      <span className="summary-row-val" style={{ fontWeight: 600, color: '#0f172a' }}>
                        {activeAuthResult.serviceName}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Approved Date:</span>
                      <span className="summary-row-val">{activeAuthResult.approvedDate || activeAuthResult.requestDate}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Valid From:</span>
                      <span className="summary-row-val" style={{ color: '#15803d', fontWeight: 600 }}>
                        {activeAuthResult.validFrom || activeAuthResult.requestDate}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Valid Until:</span>
                      <span className="summary-row-val" style={{ color: '#15803d', fontWeight: 600 }}>
                        {activeAuthResult.validUntil || '2024-08-30'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #bbf7d0', display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleOpenStatusModal(activeAuthResult)}
                      style={{ fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}
                    >
                      <Edit size={13} /> Update Result Details
                    </button>
                  </div>
                </div>
              ) : activeAuthResult.status === 'Denied' ? (
                /* DENIED RESULT */
                <div
                  className="summary-card animate-fade-in"
                  style={{
                    border: '1px solid #fca5a5',
                    background: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)',
                    boxShadow: '0 4px 16px -2px rgba(239, 68, 68, 0.15)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <XCircle size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#991b1b' }}>
                        ✕ Authorization Denied
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                        Request ID: {activeAuthResult.authorizationRequestId}
                      </span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: 8, border: '1px solid #fecaca', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', marginBottom: 2 }}>
                      Denial Reason:
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.4 }}>
                      {activeAuthResult.denialReason || 'Clinical criteria for advanced diagnostic imaging not met.'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff7ed', padding: '10px 12px', borderRadius: 8, border: '1px solid #ffedd5', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c2410c', marginBottom: 2 }}>
                      Suggested Next Action:
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#7c2d12', lineHeight: 1.4 }}>
                      {activeAuthResult.suggestedAction || 'Submit Peer-to-Peer physician appeal with 6-week therapy records.'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleOpenStatusModal(activeAuthResult, 'Approved')}
                      style={{ fontSize: '0.75rem', width: '100%', justifyContent: 'center', color: '#15803d', borderColor: '#86efac' }}
                    >
                      Simulate Appeal Approval →
                    </button>
                  </div>
                </div>
              ) : activeAuthResult.status === 'Not Required' ? (
                /* NOT REQUIRED RESULT */
                <div
                  className="summary-card animate-fade-in"
                  style={{
                    border: '1px solid #bfdbfe',
                    background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
                    boxShadow: '0 4px 16px -2px rgba(59, 130, 246, 0.15)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Check size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e40af' }}>
                        No Prior Authorization Required
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                        Standard Outpatient Service Pre-Cleared
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', color: '#334155', lineHeight: 1.4 }}>
                    {activeAuthResult.serviceName} ({activeAuthResult.procedureCode}) is eligible for immediate scheduling without payer pre-certification.
                  </p>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Request ID: <strong>{activeAuthResult.authorizationRequestId}</strong>
                  </div>
                </div>
              ) : (
                /* PENDING RESULT */
                <div
                  className="summary-card animate-fade-in"
                  style={{
                    border: '1px solid #fde68a',
                    background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
                    boxShadow: '0 4px 16px -2px rgba(245, 158, 11, 0.15)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Clock size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#92400e' }}>
                        Authorization Request Pending
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#b45309' }}>
                        Submitted to Payer (EDI 278)
                      </span>
                    </div>
                  </div>

                  <div className="summary-rows-list" style={{ fontSize: '0.8125rem', marginBottom: 14 }}>
                    <div className="summary-row">
                      <span className="summary-row-label">Request ID:</span>
                      <span className="summary-row-val" style={{ fontWeight: 700, color: '#2563eb' }}>
                        {activeAuthResult.authorizationRequestId}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Submitted Date:</span>
                      <span className="summary-row-val">{activeAuthResult.requestDate}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Insurance Provider:</span>
                      <span className="summary-row-val" style={{ fontWeight: 600 }}>
                        {activeAuthResult.insuranceProvider}
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Service:</span>
                      <span className="summary-row-val">{activeAuthResult.serviceName}</span>
                    </div>
                  </div>

                  {/* Simulated Review Actions */}
                  <div style={{ backgroundColor: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                      Simulate Payer Decision:
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleOpenStatusModal(activeAuthResult, 'Approved')}
                        style={{ backgroundColor: '#16a34a', flex: 1, fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'center' }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleOpenStatusModal(activeAuthResult, 'Denied')}
                        style={{ backgroundColor: '#dc2626', flex: 1, fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'center' }}
                      >
                        ✕ Deny
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="summary-card" style={{ textAlign: 'center', padding: '24px 16px', border: '1px dashed #cbd5e1' }}>
                <FileCheck2 size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <h4 style={{ margin: '0 0 4px', fontSize: '0.9375rem', color: '#334155' }}>
                  No Active Prior Auth Selected
                </h4>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                  Submit the authorization form or select a patient from the search above to view decision metrics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 6: AUTHORIZATION MANAGEMENT TABLE */}
      <div className="dashboard-card" style={{ marginTop: 32 }}>
        <div className="dashboard-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="dashboard-card-title">Prior Authorization Management</h2>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
              All tracked procedure authorization requests across healthcare revenue cycles
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search Filter */}
            <div className="form-input-box" style={{ width: 240 }}>
              <Search size={15} className="form-input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Filter requests..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                style={{ padding: '6px 10px 6px 32px', fontSize: '0.8125rem' }}
              />
            </div>

            {/* Status Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['All', 'Pending', 'Approved', 'Denied', 'Not Required'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTableFilterStatus(st)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: tableFilterStatus === st ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    backgroundColor: tableFilterStatus === st ? '#2563eb' : '#ffffff',
                    color: tableFilterStatus === st ? '#ffffff' : '#475569'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Authorization ID</th>
                <th>Patient</th>
                <th>Requested Service</th>
                <th>Procedure Code</th>
                <th>Insurance Provider</th>
                <th>Request Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableItems.length > 0 ? (
                filteredTableItems.map((auth) => {
                  const patient = storageService.getPatients().find((p) => p.id === auth.patientId);
                  const badgeInfo = getStatusBadgeStyle(auth.status);
                  const Icon = badgeInfo.icon;

                  return (
                    <tr key={auth.id}>
                      {/* Auth ID */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.875rem' }}>
                          {auth.authorizationRequestId}
                        </div>
                        {auth.authorizationNumber && (
                          <div style={{ fontSize: '0.71875rem', color: '#15803d', fontWeight: 600 }}>
                            {auth.authorizationNumber}
                          </div>
                        )}
                      </td>

                      {/* Patient */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img
                            src={patient?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                            alt={patient?.firstName || 'Patient'}
                            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84375rem' }}>
                              {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                            </div>
                            <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                              {patient?.patientId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Requested Service */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84375rem' }}>
                          {auth.serviceName}
                        </div>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                          {auth.departmentName || 'Specialist Care'}
                        </div>
                      </td>

                      {/* Procedure Code */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.8125rem' }}>
                          {auth.procedureCode}
                        </div>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                          {auth.diagnosisCode}
                        </div>
                      </td>

                      {/* Insurance Provider */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8125rem' }}>
                          {auth.insuranceProvider}
                        </div>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                          {auth.memberId || 'N/A'}
                        </div>
                      </td>

                      {/* Request Date */}
                      <td>
                        <div style={{ fontSize: '0.8125rem', color: '#334155' }}>
                          {auth.requestDate}
                        </div>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                          Service: {auth.serviceDate}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor: badgeInfo.bg,
                            color: badgeInfo.text,
                            border: `1px solid ${badgeInfo.border}`
                          }}
                        >
                          <Icon size={12} />
                          {auth.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setViewingAuth(auth)}
                            title="View Details"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleEditRequest(auth)}
                            title="Edit Request"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <Edit size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleOpenStatusModal(auth)}
                            title="Update Status"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#2563eb', borderColor: '#bfdbfe' }}
                          >
                            <RefreshCw size={13} />
                            <span>Status</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No prior authorization requests found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW DETAILS MODAL */}
      {viewingAuth && (
        <div className="modal-backdrop" onClick={() => setViewingAuth(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 className="modal-title">Prior Authorization Details</h3>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      ...getStatusBadgeStyle(viewingAuth.status)
                    }}
                  >
                    {viewingAuth.status}
                  </span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '2px 0 0' }}>
                  Request ID: <strong style={{ color: '#2563eb' }}>{viewingAuth.authorizationRequestId}</strong>
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setViewingAuth(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Approval Info Banner if Approved */}
              {viewingAuth.status === 'Approved' && viewingAuth.authorizationNumber && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                    Authorized Number: {viewingAuth.authorizationNumber}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#166534', marginTop: 2 }}>
                    Valid from {viewingAuth.validFrom || viewingAuth.requestDate} to {viewingAuth.validUntil || '2024-08-30'}
                  </div>
                </div>
              )}

              {/* Denial Info Banner if Denied */}
              {viewingAuth.status === 'Denied' && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                    Denial Reason:
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#7f1d1d', marginTop: 2 }}>
                    {viewingAuth.denialReason || 'Payer clinical criteria not met.'}
                  </div>
                  {viewingAuth.suggestedAction && (
                    <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: 4 }}>
                      <strong>Suggested Action:</strong> {viewingAuth.suggestedAction}
                    </div>
                  )}
                </div>
              )}

              {/* Grid Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 10, border: '1px solid #f1f5f9', borderRadius: 8, backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '0.71875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Requested Service</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{viewingAuth.serviceName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>{viewingAuth.procedureCode}</div>
                </div>

                <div style={{ padding: 10, border: '1px solid #f1f5f9', borderRadius: 8, backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '0.71875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Diagnosis Code</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{viewingAuth.diagnosisCode}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Estimated Cost: ${viewingAuth.estimatedCost || 0}</div>
                </div>

                <div style={{ padding: 10, border: '1px solid #f1f5f9', borderRadius: 8, backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '0.71875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Treating Doctor</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{viewingAuth.doctorName || 'Assigned Specialist'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{viewingAuth.departmentName || 'Clinical Wing'}</div>
                </div>

                <div style={{ padding: 10, border: '1px solid #f1f5f9', borderRadius: 8, backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '0.71875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Insurance Payer</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{viewingAuth.insuranceProvider}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Member ID: {viewingAuth.memberId || 'N/A'}</div>
                </div>
              </div>

              {/* Justification */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  Medical Reason / Clinical Justification:
                </div>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: '0.8125rem', color: '#334155' }}>
                  {viewingAuth.medicalJustification}
                </div>
              </div>

              {/* Supporting Docs */}
              {viewingAuth.supportingDocuments && viewingAuth.supportingDocuments.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Attached Supporting Documents:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {viewingAuth.supportingDocuments.map((doc, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Paperclip size={12} /> {doc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const authToEdit = viewingAuth;
                  setViewingAuth(null);
                  handleEditRequest(authToEdit);
                }}
              >
                <Edit size={15} /> Edit
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
                onClick={() => {
                  const authToUpdate = viewingAuth;
                  setViewingAuth(null);
                  handleOpenStatusModal(authToUpdate);
                }}
              >
                <RefreshCw size={15} /> Update Status
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => setViewingAuth(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATED STATUS UPDATE MODAL */}
      {statusModalAuth && (
        <div className="modal-backdrop" onClick={() => setStatusModalAuth(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Simulate Payer Status Update</h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '2px 0 0' }}>
                  Request: <strong style={{ color: '#2563eb' }}>{statusModalAuth.authorizationRequestId}</strong> • Payer: {statusModalAuth.insuranceProvider}
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setStatusModalAuth(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Status Selector */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Select Updated Status:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['Approved', 'Denied', 'Pending', 'Not Required', 'Expired'] as PriorAuthStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusModalTargetStatus(st)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        border: statusModalTargetStatus === st ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: statusModalTargetStatus === st ? '#eff6ff' : '#ffffff',
                        color: statusModalTargetStatus === st ? '#1d4ed8' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* If Approved: Enter Auth Number & Dates */}
              {statusModalTargetStatus === 'Approved' && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#15803d', marginBottom: 10 }}>
                    Approval Authorization Parameters:
                  </div>

                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ color: '#14532d' }}>Authorization Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={statusModalAuthNum}
                      onChange={(e) => setStatusModalAuthNum(e.target.value)}
                      placeholder="e.g. AUTH-BCBS-994201"
                    />
                  </div>

                  <div className="form-grid-2" style={{ marginBottom: 0 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#14532d' }}>Valid From</label>
                      <input
                        type="date"
                        className="form-input"
                        value={statusModalValidFrom}
                        onChange={(e) => setStatusModalValidFrom(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#14532d' }}>Valid Until</label>
                      <input
                        type="date"
                        className="form-input"
                        value={statusModalValidUntil}
                        onChange={(e) => setStatusModalValidUntil(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* If Denied: Enter Denial Reason & Suggested Action */}
              {statusModalTargetStatus === 'Denied' && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b', marginBottom: 10 }}>
                    Denial Specifications:
                  </div>

                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ color: '#7f1d1d' }}>Denial Reason</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={statusModalDenialReason}
                      onChange={(e) => setStatusModalDenialReason(e.target.value)}
                      placeholder="Enter clinical reason for authorization rejection..."
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color: '#7f1d1d' }}>Suggested Next Action / Appeal Guidance</label>
                    <input
                      type="text"
                      className="form-input"
                      value={statusModalSuggestedAction}
                      onChange={(e) => setStatusModalSuggestedAction(e.target.value)}
                      placeholder="e.g. Peer-to-Peer physician appeal or physical therapy progress notes"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStatusModalAuth(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveStatusUpdate}
                style={{ backgroundColor: statusModalTargetStatus === 'Approved' ? '#16a34a' : statusModalTargetStatus === 'Denied' ? '#dc2626' : '#2563eb' }}
              >
                Save Updated Status ({statusModalTargetStatus})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriorAuthorizationPage;
