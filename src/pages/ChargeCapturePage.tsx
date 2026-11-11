import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Search,
  User,
  Building2,
  Calendar,
  AlertCircle,
  ArrowRight,
  Save,
  UserCheck,
  Stethoscope,
  Plus,
  Trash2,
  Calculator,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Edit2,
  CheckCircle2,
  Clock,
  FileText,
  Hash,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';
import type {
  Patient,
  Appointment,
  PatientRegistration,
  InsuranceInfo,
  ChargeCaptureItem,
  ChargeCaptureEncounter,
  CodingStatus,
  BillingStatus
} from '../types';
import { patientService } from '../services/patientService';
import { chargeService, type ChargeCaptureSearchResult } from '../services/chargeService';
import { storageService } from '../services/storageService';

interface ChargeCapturePageProps {
  preselectedPatientId?: string | null;
  onNavigateToMedicalCoding?: (patientId?: string) => void;
  onNavigateToDashboard: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ChargeCapturePage: React.FC<ChargeCapturePageProps> = ({
  preselectedPatientId,
  onNavigateToMedicalCoding,
  onNavigateToDashboard,
  onSuccess,
  onError,
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChargeCaptureSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Active Patient Context
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [linkedRegistration, setLinkedRegistration] = useState<PatientRegistration | null>(null);
  const [linkedAppointment, setLatestAppointment] = useState<Appointment | null>(null);
  const [linkedInsurance, setLinkedInsurance] = useState<InsuranceInfo | null>(null);

  // SECTION 1: Patient / Encounter Information State
  const [encounterId, setEncounterId] = useState('');
  const [encounterDate, setEncounterDate] = useState('');
  const [visitType, setVisitType] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceVerificationStatus, setInsuranceVerificationStatus] = useState('');
  const [claimStatus, setClaimStatus] = useState<'Draft' | 'Ready to Bill' | 'Billed' | 'Paid in Full' | 'Partial Paid'>('Draft');
  const [encounterNotes, setEncounterNotes] = useState('');

  // SECTION 2 & 3: Detailed Charge Items State
  const [chargeItems, setChargeItems] = useState<ChargeCaptureItem[]>([]);

  // Modal State for Add / Edit Charge
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ChargeCaptureItem | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ----------------------------------------------------
  // DYNAMIC FINANCIAL & SUMMARY CALCULATIONS
  // ----------------------------------------------------

  // Total Services Captured Count
  const totalServicesCaptured = useMemo(() => chargeItems.length, [chargeItems]);

  // Total Charges (Sum of all charge amounts)
  const totalCharges = useMemo(() => {
    return chargeItems.reduce((sum, item) => sum + (Number(item.totalCharge) || 0), 0);
  }, [chargeItems]);

  // Total Expected Insurance Coverage
  const totalExpectedInsurance = useMemo(() => {
    return chargeItems.reduce((sum, item) => sum + (Number(item.insuranceExpected) || 0), 0);
  }, [chargeItems]);

  // Total Expected Patient Responsibility
  const totalExpectedPatient = useMemo(() => {
    return chargeItems.reduce((sum, item) => sum + (Number(item.patientExpected) || 0), 0);
  }, [chargeItems]);

  // Total Insurance Paid across all services
  const totalInsurancePaid = useMemo(() => {
    return chargeItems.reduce((sum, item) => sum + (Number(item.insurancePaid) || 0), 0);
  }, [chargeItems]);

  // Total Patient Paid across all services
  const totalPatientPaid = useMemo(() => {
    return chargeItems.reduce((sum, item) => sum + (Number(item.patientPaid) || 0), 0);
  }, [chargeItems]);

  // Total Pending Balance across all services
  const totalPendingBalance = useMemo(() => {
    return chargeItems.reduce((sum, item) => {
      const charge = Number(item.totalCharge) || 0;
      const insPaid = Number(item.insurancePaid) || 0;
      const patPaid = Number(item.patientPaid) || 0;
      return sum + Math.max(0, charge - insPaid - patPaid);
    }, 0);
  }, [chargeItems]);

  // Incomplete / Missing / Unbilled Charges List (Section 5)
  const incompleteCharges = useMemo(() => {
    return chargeItems.filter((item) => {
      const missingProc = !item.procedureCode || item.procedureCode.trim() === '' || item.procedureCode.trim() === '--';
      const missingDiag = !item.diagnosisCode || item.diagnosisCode.trim() === '' || item.diagnosisCode.trim() === '--';
      const missingCharge = !item.totalCharge || item.totalCharge <= 0;
      const isUnbilled = item.billingStatus === 'Unbilled';
      const isMissingCode = item.codingStatus === 'Missing Code' || item.codingStatus === 'Pending Coding';
      return missingProc || missingDiag || missingCharge || isUnbilled || isMissingCode;
    });
  }, [chargeItems]);

  // SECTION 7: Accounts Receivable (A/R) Calculation
  // 1. Insurance Pending = Expected Insurance - Insurance Paid (min 0)
  const insurancePending = useMemo(() => {
    const diff = totalExpectedInsurance - totalInsurancePaid;
    return Math.max(0, diff);
  }, [totalExpectedInsurance, totalInsurancePaid]);

  // 2. Patient Pending = Patient Responsibility - Patient Paid (min 0)
  const patientPending = useMemo(() => {
    const diff = totalExpectedPatient - totalPatientPaid;
    return Math.max(0, diff);
  }, [totalExpectedPatient, totalPatientPaid]);

  // 3. Total Outstanding A/R = Insurance Pending + Patient Pending
  const totalOutstandingAR = useMemo(() => {
    return insurancePending + patientPending;
  }, [insurancePending, patientPending]);

  // ----------------------------------------------------
  // PATIENT DATA CONTEXT LOADER
  // ----------------------------------------------------
  const applyPatientData = useCallback((
    pat: Patient,
    appt?: Appointment | null,
    reg?: PatientRegistration | null,
    ins?: InsuranceInfo | null,
    chg?: ChargeCaptureEncounter | null
  ) => {
    setSelectedPatient(pat);
    setSearchQuery(`${pat.firstName} ${pat.lastName} (${pat.patientId})`);
    setShowSearchResults(false);
    setFormError('');

    // 1. Linked Registration & Appointment
    setLinkedRegistration(reg || storageService.getRegistrationByPatientId(pat.id));
    if (appt) {
      setLatestAppointment(appt);
      setDoctorName(appt.doctor.name);
      setDepartmentName(appt.departmentName);
      setEncounterDate(appt.appointmentDate);
      setVisitType(appt.appointmentType || 'Outpatient Consultation');
    } else {
      const allAppts = storageService.getAppointments();
      const match = allAppts.find((a) => a.patientId === pat.id);
      setLatestAppointment(match || null);
      if (match) {
        setDoctorName(match.doctor.name);
        setDepartmentName(match.departmentName);
        setEncounterDate(match.appointmentDate);
        setVisitType(match.appointmentType || 'Outpatient Consultation');
      }
    }

    // 2. Linked Insurance Info
    const existingIns = ins || storageService.getInsuranceByPatientId(pat.id);
    setLinkedInsurance(existingIns);
    if (existingIns?.insuranceProvider) {
      setInsuranceProvider(existingIns.insuranceProvider);
      setInsuranceVerificationStatus(
        existingIns.insuranceStatus === 'Active'
          ? 'Verified / Active'
          : (existingIns.eligibilityStatus || 'Verified / Active')
      );
    }

    // 3. Linked Charge Capture Encounter
    const existingChg = chg || storageService.getChargeCaptureByPatientId(pat.id);
    if (existingChg) {
      setEncounterId(existingChg.id);
      setEncounterDate(existingChg.encounterDate || new Date().toISOString().split('T')[0]);
      setVisitType(existingChg.visitType || 'Outpatient Consultation');
      setDoctorName(existingChg.doctorName || appt?.doctor?.name || '');
      setDepartmentName(existingChg.departmentName || appt?.departmentName || '');
      setInsuranceProvider(existingChg.insuranceProvider || existingIns?.insuranceProvider || '');
      setInsuranceVerificationStatus(existingChg.insuranceVerificationStatus || 'Verified / Active');
      setClaimStatus(existingChg.claimStatus || 'Draft');
      setEncounterNotes(existingChg.notes || '');

      if (existingChg.items && existingChg.items.length > 0) {
        setChargeItems(existingChg.items);
      } else {
        setChargeItems([]);
      }
    } else {
      setEncounterId(`CHG-${Math.floor(10000 + Math.random() * 90000)}`);
      setEncounterDate(new Date().toISOString().split('T')[0]);
      setVisitType('Outpatient Consultation');
      setDoctorName(appt?.doctor?.name || '');
      setDepartmentName(appt?.departmentName || '');
      setInsuranceProvider(existingIns?.insuranceProvider || '');
      setInsuranceVerificationStatus(existingIns?.insuranceStatus ? 'Verified / Active' : 'Unverified');
      setClaimStatus('Draft');
      setEncounterNotes('');
      setChargeItems([]);
    }
  }, []);

  const loadPatientContext = useCallback(async (patId: string) => {
    try {
      const patient = await patientService.getById(patId);
      if (patient) {
        applyPatientData(patient);
      }
    } catch {
      onError('Failed to load patient context for charge capture.');
    }
  }, [applyPatientData, onError]);

  // Initial load
  useEffect(() => {
    if (preselectedPatientId) {
      loadPatientContext(preselectedPatientId);
    }
  }, [preselectedPatientId, loadPatientContext]);

  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const results = await chargeService.searchPatientsForChargeCapture(query);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: ChargeCaptureSearchResult) => {
    applyPatientData(result.patient, result.appointment, result.registration, result.insurance, result.chargeCapture);
  };

  // ----------------------------------------------------
  // SECTION 3: ADD / EDIT CHARGE CRUD HANDLERS
  // ----------------------------------------------------
  const handleOpenAddNewCharge = () => {
    setEditingCharge({
      id: `item-${Date.now()}`,
      serviceDescription: '',
      category: 'Consultation',
      procedureCode: '',
      diagnosisCode: '',
      modifiers: '',
      quantity: 1,
      unitRate: 0,
      totalCharge: 0,
      insuranceExpected: 0,
      patientExpected: 0,
      insurancePaid: 0,
      patientPaid: 0,
      pendingAmount: 0,
      codingStatus: 'Pending Coding',
      billingStatus: 'Unbilled'
    });
    setIsChargeModalOpen(true);
  };

  const handleOpenEditCharge = (item: ChargeCaptureItem) => {
    setEditingCharge({ ...item });
    setIsChargeModalOpen(true);
  };

  const handleSaveChargeModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCharge || !editingCharge.serviceDescription.trim()) {
      onError('Please provide a service description.');
      return;
    }

    const qty = Math.max(1, editingCharge.quantity || 1);
    const rate = Math.max(0, editingCharge.unitRate || 0);
    const total = qty * rate;
    const insPaid = Math.max(0, editingCharge.insurancePaid || 0);
    const patPaid = Math.max(0, editingCharge.patientPaid || 0);
    const pending = Math.max(0, total - insPaid - patPaid);

    const finalized: ChargeCaptureItem = {
      ...editingCharge,
      quantity: qty,
      unitRate: rate,
      totalCharge: total,
      insurancePaid: insPaid,
      patientPaid: patPaid,
      pendingAmount: pending
    };

    setChargeItems((prev) => {
      const exists = prev.some((i) => i.id === finalized.id);
      if (exists) {
        return prev.map((i) => (i.id === finalized.id ? finalized : i));
      }
      return [...prev, finalized];
    });

    setIsChargeModalOpen(false);
    setEditingCharge(null);
    onSuccess(`✓ Charge "${finalized.serviceDescription}" saved to Captured Services!`);
  };

  const handleDeleteChargeItem = (id: string) => {
    if (chargeItems.length <= 1) {
      onError('At least one charge line item is required.');
      return;
    }
    setChargeItems((prev) => prev.filter((item) => item.id !== id));
    onSuccess('Charge line item removed.');
  };

  // Quick Payment Simulator Handlers
  const handleSimulatePayment = (mode: 'partial' | 'full' | 'reset') => {
    if (mode === 'partial') {
      setChargeItems((prev) =>
        prev.map((item) => {
          if (item.id === 'item-1') return { ...item, insurancePaid: 800, patientPaid: 100, pendingAmount: 100, billingStatus: 'Pending' };
          if (item.id === 'item-2') return { ...item, insurancePaid: 400, patientPaid: 50, pendingAmount: 50, billingStatus: 'Partial Payment' };
          if (item.id === 'item-4') return { ...item, insurancePaid: 80, patientPaid: 20, pendingAmount: 0, billingStatus: 'Paid in Full' };
          if (item.id === 'item-5') return { ...item, insurancePaid: 200, patientPaid: 50, pendingAmount: 50, billingStatus: 'Partial Payment' };
          return item;
        })
      );
      setClaimStatus('Partial Paid');
      onSuccess('✓ Simulated partial payments posted across services.');
    } else if (mode === 'full') {
      setChargeItems((prev) =>
        prev.map((item) => {
          const expIns = item.insuranceExpected || Math.round(item.totalCharge * 0.8);
          const expPat = Math.max(0, item.totalCharge - expIns);
          return {
            ...item,
            procedureCode: item.procedureCode || 'CPT-93000',
            codingStatus: 'Coded',
            billingStatus: 'Paid in Full',
            insurancePaid: expIns,
            patientPaid: expPat,
            pendingAmount: 0
          };
        })
      );
      setClaimStatus('Paid in Full');
      onSuccess('✓ Full settlement recorded! All services paid and pending balance is $0.00.');
    } else {
      setChargeItems((prev) =>
        prev.map((item) => ({
          ...item,
          insurancePaid: 0,
          patientPaid: 0,
          pendingAmount: item.totalCharge,
          billingStatus: item.codingStatus === 'Missing Code' ? 'Unbilled' : 'Pending'
        }))
      );
      setClaimStatus('Ready to Bill');
      onSuccess('Payment received values reset to $0.00.');
    }
  };

  // Save All Changes to Storage
  const handleSaveAll = async () => {
    setFormError('');
    if (!selectedPatient) {
      setFormError('Please select an active patient first.');
      return;
    }
    if (chargeItems.length === 0) {
      setFormError('Please include at least one billable service.');
      return;
    }

    setIsSaving(true);
    try {
      const record: ChargeCaptureEncounter = {
        id: encounterId,
        patientId: selectedPatient.id,
        appointmentId: linkedAppointment?.id,
        encounterDate,
        visitType,
        doctorId: linkedAppointment?.doctorId || 'doc-1',
        doctorName,
        departmentId: linkedAppointment?.departmentId || 'dept-1',
        departmentName,
        insuranceProvider,
        memberId: linkedInsurance?.memberId || 'BCBS-9021882',
        policyNumber: linkedInsurance?.policyNumber || 'POL-77218-01',
        insuranceVerificationStatus,
        claimStatus,
        items: chargeItems,
        totalCharges,
        expectedInsuranceCoverage: totalExpectedInsurance,
        insuranceReceived: totalInsurancePaid,
        insurancePending,
        patientResponsibility: totalExpectedPatient,
        patientPaid: totalPatientPaid,
        patientPending,
        totalOutstandingAR,
        notes: encounterNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await chargeService.save(record);
      onSuccess(`✓ Charge capture record #${encounterId} and all A/R balances saved successfully!`);
    } catch {
      onError('Failed to save charge capture record.');
    } finally {
      setIsSaving(false);
    }
  };

  // Status Badge Helper Functions
  const getCodingStatusBadge = (status?: CodingStatus) => {
    switch (status) {
      case 'Coded':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac', icon: CheckCircle2, label: 'Coded' };
      case 'Pending Coding':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', icon: Clock, label: 'Pending Coding' };
      case 'Missing Code':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', icon: AlertTriangle, label: 'Missing Code' };
      case 'Coding Audit Required':
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: Info, label: 'Audit Req' };
      default:
        return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', icon: Clock, label: status || 'Pending' };
    }
  };

  const getBillingStatusBadge = (status?: BillingStatus) => {
    switch (status) {
      case 'Paid in Full':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'Paid in Full' };
      case 'Partial Payment':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'Partial Payment' };
      case 'Pending':
        return { bg: '#fffbeb', text: '#92400e', border: '#fde68a', label: 'Pending' };
      case 'Submitted':
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', label: 'Submitted' };
      case 'Unbilled':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', label: 'Unbilled' };
      case 'Rejected':
        return { bg: '#fef2f2', text: '#991b1b', border: '#f87171', label: 'Rejected' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: status || 'Draft' };
    }
  };

  return (
    <div className="page-body animate-fade-in" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: 4, border: '1px solid #bfdbfe' }}>
              Module 5
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Revenue Cycle Management</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Charge Capture & Medical Coding
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Record every billable service, validate CPT procedure and ICD-10 diagnosis coding, track payments, and review A/R balances.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveAll}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#2563eb' }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Charge Capture'}</span>
          </button>
          {onNavigateToMedicalCoding && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigateToMedicalCoding(selectedPatient?.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#7c3aed' }}
            >
              <span>Proceed to Medical Coding</span>
              <ArrowRight size={16} />
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={onNavigateToDashboard}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#0f172a' }}
          >
            <span>Dashboard</span>
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

      {/* ==================================================== */}
      {/* SECTION 1: PATIENT / ENCOUNTER INFORMATION */}
      {/* ==================================================== */}
      <div className="form-section-card" style={{ marginBottom: 24 }}>
        <div className="form-section-header">
          <div className="form-section-title-wrap">
            <div className="section-number-badge">1</div>
            <div>
              <h2 className="section-title-text" style={{ margin: 0 }}>Patient / Encounter Information</h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Select patient encounter and review verified demographic, clinical, and payer credentials</span>
            </div>
          </div>

          {selectedPatient && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                Encounter: {encounterId}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                {claimStatus}
              </span>
            </div>
          )}
        </div>

        {/* Patient Search Lookup */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Lookup Patient by Name, Patient ID, or Appointment Code
            </label>
            <div className="form-input-box">
              <Search size={16} className="form-input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search patient for charge capture (e.g. Rahul Kumar, P10023, APT10001)..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim()) setShowSearchResults(true);
                }}
              />
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchResults && (isSearching || searchResults.length > 0) && (
            <div className="patient-search-dropdown animate-fade-in" style={{ zIndex: 100 }}>
              {isSearching ? (
                <div style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.875rem' }}>
                  Searching patient records...
                </div>
              ) : (
                searchResults.map((res: ChargeCaptureSearchResult) => (
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
                          ID: <span style={{ fontWeight: 600, color: '#4f46e5' }}>{res.patient.patientId}</span>
                          {res.insurance?.insuranceProvider && (
                            <span style={{ marginLeft: 6, color: '#059669', fontWeight: 600 }}>
                              • {res.insurance.insuranceProvider}
                            </span>
                          )}
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

        {/* Top Summary Card */}
        {selectedPatient ? (
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <User size={14} color="#2563eb" /> Patient Name
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Hash size={14} color="#2563eb" /> Patient ID
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#4f46e5', marginTop: 2 }}>
                  {selectedPatient.patientId}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FileText size={14} color="#2563eb" /> Encounter ID
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {encounterId}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Stethoscope size={14} color="#2563eb" /> Doctor Name
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {doctorName}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={14} color="#2563eb" /> Department
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                  {departmentName}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={14} color="#2563eb" /> Date of Service
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {encounterDate}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={14} color="#059669" /> Insurance Provider
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#059669', marginTop: 2 }}>
                  {insuranceProvider}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={14} color="#2563eb" /> Intake / Govt ID
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginTop: 2 }}>
                  {linkedRegistration ? `${linkedRegistration.idType}: ${linkedRegistration.idNumber}` : 'Verified'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#64748b', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} />
            <span>Please select a patient from the search bar above.</span>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* SECTION 2 & 3: DETAILED CHARGE CAPTURE LISTING */}
      {/* ==================================================== */}
      <div className="form-section-card" style={{ marginBottom: 24 }}>
        <div className="form-section-header">
          <div className="form-section-title-wrap">
            <div className="section-number-badge" style={{ backgroundColor: '#2563eb' }}>2</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={18} color="#2563eb" />
                <h2 className="section-title-text" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  CAPTURED SERVICES & CHARGES
                </h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Every billable service, procedural code, diagnosis code, financial adjudication, and status
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
              {chargeItems.length} Captured Service{chargeItems.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenAddNewCharge}
              style={{ padding: '6px 14px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, backgroundColor: '#2563eb' }}
            >
              <Plus size={14} />
              <span>+ Add New Charge</span>
            </button>
          </div>
        </div>

        {/* Detailed Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '12px 12px', width: '20%' }}>1. Service Description</th>
                <th style={{ padding: '12px 10px', width: '12%' }}>2. Procedure Code</th>
                <th style={{ padding: '12px 10px', width: '12%' }}>3. Diagnosis Code</th>
                <th style={{ padding: '12px 10px', width: '10%', textAlign: 'right' }}>4. Charge Amount</th>
                <th style={{ padding: '12px 10px', width: '9%', textAlign: 'right' }}>5. Ins. Paid</th>
                <th style={{ padding: '12px 10px', width: '9%', textAlign: 'right' }}>6. Pat. Paid</th>
                <th style={{ padding: '12px 10px', width: '10%', textAlign: 'right' }}>7. Pending Amount</th>
                <th style={{ padding: '12px 10px', width: '10%', textAlign: 'center' }}>8. Coding Status</th>
                <th style={{ padding: '12px 10px', width: '10%', textAlign: 'center' }}>9. Billing Status</th>
                <th style={{ padding: '12px 6px', width: '6%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {chargeItems.map((item, index) => {
                const codingBadge = getCodingStatusBadge(item.codingStatus);
                const billingBadge = getBillingStatusBadge(item.billingStatus);
                const CodingIcon = codingBadge.icon;
                const pending = Math.max(0, (item.totalCharge || 0) - (item.insurancePaid || 0) - (item.patientPaid || 0));

                const isMissingCode = !item.procedureCode || item.procedureCode.trim() === '' || item.procedureCode.trim() === '--';

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: index < chargeItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                      backgroundColor: isMissingCode ? '#fff7ed' : index % 2 === 0 ? '#ffffff' : '#fafafa'
                    }}
                  >
                    {/* 1. Service Description */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84375rem' }}>
                        {item.serviceDescription}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span>{item.category || 'Clinical Care'}</span>
                        {item.quantity > 1 && <span>• Qty: {item.quantity}</span>}
                      </div>
                    </td>

                    {/* 2. Procedure Code */}
                    <td style={{ padding: '10px 10px' }}>
                      {item.procedureCode && item.procedureCode.trim() !== '' ? (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            color: '#1e40af',
                            backgroundColor: '#eff6ff',
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: '1px solid #bfdbfe',
                            display: 'inline-block'
                          }}
                        >
                          {item.procedureCode}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5' }}>
                          ⚠️ Missing Code
                        </span>
                      )}
                    </td>

                    {/* 3. Diagnosis Code */}
                    <td style={{ padding: '10px 10px' }}>
                      {item.diagnosisCode && item.diagnosisCode.trim() !== '' ? (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            color: '#7c3aed',
                            backgroundColor: '#f5f3ff',
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: '1px solid #ddd6fe',
                            display: 'inline-block'
                          }}
                        >
                          {item.diagnosisCode}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>--</span>
                      )}
                    </td>

                    {/* 4. Charge Amount */}
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>
                      ${item.totalCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* 5. Insurance Paid */}
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: (item.insurancePaid || 0) > 0 ? '#15803d' : '#64748b' }}>
                      ${(item.insurancePaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* 6. Patient Paid */}
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: (item.patientPaid || 0) > 0 ? '#b45309' : '#64748b' }}>
                      ${(item.patientPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* 7. Pending Amount */}
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 900, color: pending > 0 ? '#dc2626' : '#15803d', fontSize: '0.875rem' }}>
                      ${pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* 8. Coding Status */}
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          backgroundColor: codingBadge.bg,
                          color: codingBadge.text,
                          border: `1px solid ${codingBadge.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}
                      >
                        <CodingIcon size={11} />
                        {codingBadge.label}
                      </span>
                    </td>

                    {/* 9. Billing Status */}
                    <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          backgroundColor: billingBadge.bg,
                          color: billingBadge.text,
                          border: `1px solid ${billingBadge.border}`
                        }}
                      >
                        {billingBadge.label}
                      </span>
                    </td>

                    {/* 10. Action */}
                    <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditCharge(item)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 4, borderRadius: 4 }}
                          title="Edit Charge"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChargeItem(item.id)}
                          disabled={chargeItems.length <= 1}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: chargeItems.length <= 1 ? 'not-allowed' : 'pointer',
                            color: chargeItems.length <= 1 ? '#cbd5e1' : '#ef4444',
                            padding: 4,
                            borderRadius: 4
                          }}
                          title="Delete Charge"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Quick Simulator and Action Bar */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOpenAddNewCharge}
            style={{ padding: '6px 14px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Plus size={14} color="#2563eb" />
            <span>+ Add New Charge</span>
          </button>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Quick Payment Presets:</span>
            <button
              type="button"
              onClick={() => handleSimulatePayment('partial')}
              style={{ fontSize: '0.6875rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #93c5fd', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}
            >
              ⚡ Example Partial Payments
            </button>
            <button
              type="button"
              onClick={() => handleSimulatePayment('full')}
              style={{ fontSize: '0.6875rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #86efac', backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 700, cursor: 'pointer' }}
            >
              ⚡ Full Settlement ($0 Balance)
            </button>
            <button
              type="button"
              onClick={() => handleSimulatePayment('reset')}
              style={{ fontSize: '0.6875rem', padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
            >
              Reset $0 Paid
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SECTION 4: CHARGE CAPTURE SUMMARY */}
      {/* ==================================================== */}
      <div className="form-section-card" style={{ marginBottom: 24 }}>
        <div className="form-section-header">
          <div className="form-section-title-wrap">
            <div className="section-number-badge" style={{ backgroundColor: '#059669' }}>4</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={18} color="#059669" />
                <h2 className="section-title-text" style={{ margin: 0 }}>Charge Capture Summary</h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Summary totals automatically calculated from the individual captured service rows
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {/* Total Services Captured */}
          <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              Total Services Captured
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#0f172a' }}>
              {totalServicesCaptured} <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Services</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: 4 }}>
              Distinct encounter items
            </div>
          </div>

          {/* Total Charges */}
          <div style={{ backgroundColor: '#eff6ff', padding: '14px 16px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              Total Charges
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#1e3a8a' }}>
              ${totalCharges.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#3b82f6', marginTop: 4 }}>
              Gross captured charges
            </div>
          </div>

          {/* Total Insurance Paid */}
          <div style={{ backgroundColor: '#f0fdf4', padding: '14px 16px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              Total Insurance Paid
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#15803d' }}>
              ${totalInsurancePaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#166534', marginTop: 4 }}>
              Remittance received
            </div>
          </div>

          {/* Total Patient Paid */}
          <div style={{ backgroundColor: '#fffbeb', padding: '14px 16px', borderRadius: 8, border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              Total Patient Paid
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#b45309' }}>
              ${totalPatientPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#92400e', marginTop: 4 }}>
              Copays & deductibles paid
            </div>
          </div>

          {/* Total Pending Balance */}
          <div style={{ backgroundColor: '#fef2f2', padding: '14px 16px', borderRadius: 8, border: '1px solid #fca5a5' }}>
            <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              Total Pending Balance
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#b91c1c' }}>
              ${totalPendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#991b1b', marginTop: 4 }}>
              Total uncollected amount
            </div>
          </div>

          {/* Missing or Unbilled Charges */}
          <div style={{ backgroundColor: incompleteCharges.length > 0 ? '#fff7ed' : '#f0fdf4', padding: '14px 16px', borderRadius: 8, border: `1px solid ${incompleteCharges.length > 0 ? '#fed7aa' : '#bbf7d0'}` }}>
            <div style={{ fontSize: '0.75rem', color: incompleteCharges.length > 0 ? '#9a3412' : '#166534', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              Missing / Unbilled
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: incompleteCharges.length > 0 ? '#c2410c' : '#15803d' }}>
              {incompleteCharges.length} <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{incompleteCharges.length === 1 ? 'Item' : 'Items'}</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: incompleteCharges.length > 0 ? '#c2410c' : '#166534', marginTop: 4 }}>
              {incompleteCharges.length > 0 ? 'Requires attention' : 'All coded & billed'}
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SECTION 5: MISSING OR UNBILLED CHARGES */}
      {/* ==================================================== */}
      <div className="form-section-card" style={{ marginBottom: 24, border: incompleteCharges.length > 0 ? '1px solid #fed7aa' : '1px solid #bbf7d0', backgroundColor: incompleteCharges.length > 0 ? '#fffdfa' : '#fafdfb' }}>
        <div className="form-section-header">
          <div className="form-section-title-wrap">
            <div className="section-number-badge" style={{ backgroundColor: incompleteCharges.length > 0 ? '#ea580c' : '#16a34a' }}>5</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {incompleteCharges.length > 0 ? <AlertTriangle size={18} color="#ea580c" /> : <ShieldCheck size={18} color="#16a34a" />}
                <h2 className="section-title-text" style={{ margin: 0, color: incompleteCharges.length > 0 ? '#9a3412' : '#14532d' }}>
                  Missing or Unbilled Charges
                </h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Audit detection for missing CPT procedure codes, ICD-10 diagnosis codes, unbilled services, and zero charge items
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 12,
              backgroundColor: incompleteCharges.length > 0 ? '#ffedd5' : '#dcfce7',
              color: incompleteCharges.length > 0 ? '#c2410c' : '#15803d',
              border: `1px solid ${incompleteCharges.length > 0 ? '#fed7aa' : '#86efac'}`
            }}
          >
            {incompleteCharges.length > 0 ? `${incompleteCharges.length} Incomplete Item(s)` : '✓ All Charges Complete'}
          </span>
        </div>

        {incompleteCharges.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {incompleteCharges.map((item) => {
              const missingProc = !item.procedureCode || item.procedureCode.trim() === '' || item.procedureCode.trim() === '--';
              const missingDiag = !item.diagnosisCode || item.diagnosisCode.trim() === '' || item.diagnosisCode.trim() === '--';
              const isUnbilled = item.billingStatus === 'Unbilled';

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: 8,
                    flexWrap: 'wrap',
                    gap: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ffedd5', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#9a3412' }}>
                        ⚠ Action Required – {missingProc ? 'Procedure Code Missing' : missingDiag ? 'Diagnosis Code Missing' : isUnbilled ? `Unbilled Service ($${item.totalCharge.toLocaleString()})` : 'Coding Review Required'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#7c2d12', marginTop: 2 }}>
                        Service: <strong>{item.serviceDescription}</strong> ({item.category || 'General Care'}) • Status: {item.billingStatus}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleOpenEditCharge(item)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: '#ea580c'
                    }}
                  >
                    Fix Coding / Bill Now
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '14px 18px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={20} color="#16a34a" />
            <span style={{ fontSize: '0.84375rem', color: '#166534', fontWeight: 600 }}>
              All captured charges have valid CPT/ICD-10 codes, non-zero amounts, and active billing statuses.
            </span>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* SECTION 7: ACCOUNTS RECEIVABLE QUICK SUMMARY */}
      {/* ==================================================== */}
      <div
        className="form-section-card animate-fade-in"
        style={{
          border: '1px solid #c7d2fe',
          background: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)',
          boxShadow: '0 4px 16px -2px rgba(99, 102, 241, 0.08)'
        }}
      >
        <div className="form-section-header">
          <div className="form-section-title-wrap">
            <div className="section-number-badge" style={{ backgroundColor: '#7c3aed' }}>7</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={20} color="#7c3aed" />
                <h2 className="section-title-text" style={{ margin: 0, color: '#4c1d95', fontWeight: 800 }}>
                  Accounts Receivable (A/R) Quick Summary
                </h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#6b21a8' }}>
                Final financial overview showing pending balances from insurance company and patient responsibility
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 12,
              backgroundColor: totalOutstandingAR === 0 ? '#dcfce7' : '#f5f3ff',
              color: totalOutstandingAR === 0 ? '#15803d' : '#6d28d9',
              border: `1px solid ${totalOutstandingAR === 0 ? '#86efac' : '#ddd6fe'}`
            }}
          >
            {totalOutstandingAR === 0 ? '✓ Settled (Paid in Full)' : 'A/R Pending'}
          </span>
        </div>

        {/* THREE PROMINENT SUMMARY CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
          {/* Card 1: Insurance Pending */}
          <div
            style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              padding: 16,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                1. Insurance Pending
              </span>
              <Building2 size={18} color="#2563eb" />
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#1e3a8a', lineHeight: 1.2 }}>
              ${insurancePending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 6 }}>
              Expected (${totalExpectedInsurance.toLocaleString()}) − Paid (${totalInsurancePaid.toLocaleString()})
            </div>
          </div>

          {/* Card 2: Patient Pending */}
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 10,
              padding: 16,
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.06)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                2. Patient Pending
              </span>
              <UserCheck size={18} color="#d97706" />
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#78350f', lineHeight: 1.2 }}>
              ${patientPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: 6 }}>
              Responsibility (${totalExpectedPatient.toLocaleString()}) − Paid (${totalPatientPaid.toLocaleString()})
            </div>
          </div>

          {/* Card 3: Total Outstanding A/R */}
          <div
            style={{
              backgroundColor: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: 10,
              padding: 16,
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                3. Total Outstanding A/R
              </span>
              <Wallet size={18} color="#7c3aed" />
            </div>
            <div style={{ fontSize: '1.625rem', fontWeight: 900, color: '#4c1d95', lineHeight: 1.2 }}>
              ${totalOutstandingAR.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: 6 }}>
              Insurance Pending + Patient Pending
            </div>
          </div>
        </div>

        {/* DETAILED FINANCIAL BREAKDOWN */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Calculator size={16} color="#7c3aed" />
            <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
              Detailed Financial Breakdown
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Insurance Payer Financials */}
            <div style={{ border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#2563eb" />
                <span>Insurance Payer Financials</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>Expected Insurance Coverage:</span>
                  <strong style={{ color: '#0f172a' }}>${totalExpectedInsurance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#166534', fontWeight: 600 }}>Total Insurance Received:</span>
                  <strong style={{ color: '#15803d' }}>${totalInsurancePaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#1e40af', fontWeight: 800 }}>Insurance Pending:</span>
                  <strong style={{ color: '#1e40af', fontSize: '1rem' }}>
                    ${insurancePending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Patient Responsibility Financials */}
            <div style={{ border: '1px solid #fde68a', borderRadius: 8, padding: 14, backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#92400e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserCheck size={16} color="#d97706" />
                <span>Patient Responsibility Financials</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>Patient Responsibility:</span>
                  <strong style={{ color: '#0f172a' }}>${totalExpectedPatient.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#b45309', fontWeight: 600 }}>Total Patient Paid:</span>
                  <strong style={{ color: '#b45309' }}>${totalPatientPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#92400e', fontWeight: 800 }}>Patient Pending:</span>
                  <strong style={{ color: '#92400e', fontSize: '1rem' }}>
                    ${patientPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Final Outstanding Summary Footer */}
          <div
            style={{
              marginTop: 16,
              padding: '12px 18px',
              backgroundColor: '#f5f3ff',
              borderRadius: 6,
              border: '1px solid #ddd6fe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={18} color="#7c3aed" />
              <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#4c1d95' }}>
                Total Outstanding A/R (Insurance Pending + Patient Pending):
              </span>
            </div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: '#6d28d9' }}>
              ${totalOutstandingAR.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {onNavigateToMedicalCoding && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigateToMedicalCoding(selectedPatient?.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#7c3aed',
                padding: '10px 20px',
                fontSize: '0.9375rem',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
              }}
            >
              <span>Proceed to Medical Coding (Module 6)</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* MODAL: ADD / EDIT CHARGE ITEM */}
      {/* ==================================================== */}
      {isChargeModalOpen && editingCharge && (
        <div className="modal-backdrop animate-fade-in" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: 620, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                  {chargeItems.some((i) => i.id === editingCharge.id) ? 'Edit Captured Service & Charge' : 'Add New Charge'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsChargeModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveChargeModal}>
              <div className="form-group">
                <label className="form-label">Service / Treatment Description *</label>
                <input
                  type="text"
                  className="form-input no-icon"
                  required
                  placeholder="e.g. Doctor Consultation, Blood Test, X-Ray, Minor Procedure"
                  value={editingCharge.serviceDescription}
                  onChange={(e) => setEditingCharge({ ...editingCharge, serviceDescription: e.target.value })}
                />
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select no-icon"
                    value={editingCharge.category || 'Consultation'}
                    onChange={(e) => setEditingCharge({ ...editingCharge, category: e.target.value })}
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Laboratory Test">Laboratory Test</option>
                    <option value="Diagnostic Test">Diagnostic Test</option>
                    <option value="Medication">Medication</option>
                    <option value="Procedure">Procedure</option>
                    <option value="Room & Nursing">Room & Nursing</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Procedure Code (CPT/HCPCS/NDC)</label>
                  <input
                    type="text"
                    className="form-input no-icon"
                    placeholder="e.g. CPT-99213, CPT-80053"
                    value={editingCharge.procedureCode}
                    onChange={(e) => setEditingCharge({ ...editingCharge, procedureCode: e.target.value })}
                    style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e40af' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Diagnosis Code (ICD-10)</label>
                  <input
                    type="text"
                    className="form-input no-icon"
                    placeholder="e.g. ICD-10-R50.9, ICD-10-R53.1"
                    value={editingCharge.diagnosisCode}
                    onChange={(e) => setEditingCharge({ ...editingCharge, diagnosisCode: e.target.value })}
                    style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-input no-icon"
                    min="1"
                    value={editingCharge.quantity}
                    onChange={(e) => {
                      const qty = Math.max(1, parseInt(e.target.value) || 1);
                      const rate = editingCharge.unitRate || 0;
                      setEditingCharge({
                        ...editingCharge,
                        quantity: qty,
                        totalCharge: qty * rate
                      });
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Charge Amount ($) *</label>
                  <input
                    type="number"
                    className="form-input no-icon"
                    min="0"
                    step="50"
                    required
                    value={editingCharge.totalCharge}
                    onChange={(e) => {
                      const total = Math.max(0, parseFloat(e.target.value) || 0);
                      const insExp = Math.round(total * 0.8);
                      const patExp = Math.max(0, total - insExp);
                      setEditingCharge({
                        ...editingCharge,
                        totalCharge: total,
                        unitRate: total / (editingCharge.quantity || 1),
                        insuranceExpected: insExp,
                        patientExpected: patExp
                      });
                    }}
                    style={{ fontWeight: 800, color: '#0f172a' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Coding Status</label>
                  <select
                    className="form-select no-icon"
                    value={editingCharge.codingStatus || 'Coded'}
                    onChange={(e) => setEditingCharge({ ...editingCharge, codingStatus: e.target.value as CodingStatus })}
                  >
                    <option value="Coded">Coded</option>
                    <option value="Pending Coding">Pending Coding</option>
                    <option value="Missing Code">Missing Code</option>
                    <option value="Coding Audit Required">Coding Audit Required</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Insurance Paid ($)</label>
                  <input
                    type="number"
                    className="form-input no-icon"
                    min="0"
                    value={editingCharge.insurancePaid || 0}
                    onChange={(e) => setEditingCharge({ ...editingCharge, insurancePaid: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ fontWeight: 700, color: '#15803d' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Patient Paid ($)</label>
                  <input
                    type="number"
                    className="form-input no-icon"
                    min="0"
                    value={editingCharge.patientPaid || 0}
                    onChange={(e) => setEditingCharge({ ...editingCharge, patientPaid: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ fontWeight: 700, color: '#b45309' }}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Billing Status</label>
                  <select
                    className="form-select no-icon"
                    value={editingCharge.billingStatus || 'Pending'}
                    onChange={(e) => setEditingCharge({ ...editingCharge, billingStatus: e.target.value as BillingStatus })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partial Payment">Partial Payment</option>
                    <option value="Paid in Full">Paid in Full</option>
                    <option value="Unbilled">Unbilled</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Calculated Pending Amount</label>
                  <input
                    type="text"
                    className="form-input no-icon"
                    disabled
                    value={`$${Math.max(0, (editingCharge.totalCharge || 0) - (editingCharge.insurancePaid || 0) - (editingCharge.patientPaid || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    style={{ fontWeight: 800, color: '#dc2626', backgroundColor: '#fff1f2' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsChargeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  Save Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
