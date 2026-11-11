import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search,
  Info,
  User,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Save,
  RefreshCw,
  FileCheck2,
  UserCheck,
  Stethoscope,
  Clock,
  Lock,
  Unlock,
  ShieldAlert,
  Send,
  Paperclip,
  FileText,
  X,
  Check,
  MessageSquare,
  Plus,
  Trash2,
  Calculator,
  Receipt
} from 'lucide-react';
import type {
  Patient,
  InsuranceInfo,
  InsuranceStatus,
  EligibilityStatus,
  Appointment,
  PatientRegistration,
  InsuranceVerificationResult,
  ProviderVerificationStatus,
  InsuranceCommunicationRequest,
  ChatAttachment,
  ChatMessage,
  RequestTimelineStep,
  TreatmentBillingItem
} from '../types';
import { patientService } from '../services/patientService';
import { insuranceService, type InsuranceSearchResult } from '../services/insuranceService';
import { storageService } from '../services/storageService';

interface InsuranceVerificationPageProps {
  preselectedPatientId?: string | null;
  onNavigateToPriorAuth?: (patientId: string) => void;
  onNavigateToDashboard: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const DEFAULT_BILLING_SERVICES: TreatmentBillingItem[] = [];

export const InsuranceVerificationPage: React.FC<InsuranceVerificationPageProps> = ({
  preselectedPatientId,
  onNavigateToPriorAuth,
  onNavigateToDashboard,
  onSuccess,
  onError,
}) => {
  // STEP 1: Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InsuranceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Active Patient Context
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [linkedRegistration, setLinkedRegistration] = useState<PatientRegistration | null>(null);
  const [linkedAppointment, setLatestAppointment] = useState<Appointment | null>(null);

  // STEP 2: Primary Insurance Policy & Request Details
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [memberId, setMemberId] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyHolderName, setPolicyHolderName] = useState('');
  const [relationshipToPatient, setRelationshipToPatient] = useState<'Self' | 'Spouse' | 'Child' | 'Parent' | 'Other'>('Self');
  const [groupNumber, setGroupNumber] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Treatment & Billing Breakdown Table state
  const [billingBreakdown, setBillingBreakdown] = useState<TreatmentBillingItem[]>([]);
  const [requestedAmount, setRequestedAmount] = useState<number>(0);

  // Auto-calculated Total Estimated Treatment Amount (Sum of all service rows)
  const totalEstimatedTreatmentAmount = useMemo(() => {
    return billingBreakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [billingBreakdown]);

  // Auto-calculated Patient Responsibility Amount = Total - Requested
  const patientResponsibilityAmount = useMemo(() => {
    const diff = totalEstimatedTreatmentAmount - (Number(requestedAmount) || 0);
    return Math.max(0, diff);
  }, [totalEstimatedTreatmentAmount, requestedAmount]);

  // STEP 3: Request Communication & Timeline State
  const [activeCommunicationRequest, setActiveCommunicationRequest] = useState<InsuranceCommunicationRequest | null>(null);
  const [chatInputText, setChatInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSimulatingResponse, setIsSimulatingResponse] = useState(false);

  // STEP 4: Provider Verification Result & Coverage State
  const [providerStatus, setProviderStatus] = useState<ProviderVerificationStatus | null>('Accepted');
  const [providerStatusCheckedAt, setProviderStatusCheckedAt] = useState<string | null>(null);
  const [providerStatusReason, setProviderStatusReason] = useState<string>('');
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus>('Active');
  const [eligibilityStatus, setEligibilityStatus] = useState<EligibilityStatus>('Eligible');
  const [coverageStatus, setCoverageStatus] = useState('Consultation, Outpatient Care, and Diagnostic Procedures');
  const [copayAmount, setCopayAmount] = useState<number>(20);
  const [deductible, setDeductible] = useState<number>(500);
  const [coinsurance, setCoinsurance] = useState<number>(20);
  const [coveredServices, setCoveredServices] = useState<string[]>([
    'Outpatient Consultation',
    'Diagnostic Lab Testing',
    'Preventative Screenings',
    'Specialist Consultations'
  ]);
  const [verificationResult, setVerificationResult] = useState<InsuranceVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeCommunicationRequest?.messages]);

  const applyPatientData = useCallback((
    pat: Patient,
    appt?: Appointment | null,
    reg?: PatientRegistration | null,
    ins?: InsuranceInfo | null
  ) => {
    setSelectedPatient(pat);
    setSearchQuery(`${pat.firstName} ${pat.lastName} (${pat.patientId})`);
    setShowSearchResults(false);
    setFormError('');

    // 1. Linked Registration
    if (reg) {
      setLinkedRegistration(reg);
    } else {
      const existingReg = storageService.getRegistrationByPatientId(pat.id);
      setLinkedRegistration(existingReg);
    }

    // 2. Linked Appointment
    if (appt) {
      setLatestAppointment(appt);
    } else {
      const allAppts = storageService.getAppointments();
      const match = allAppts.find((a) => a.patientId === pat.id);
      setLatestAppointment(match || null);
    }

    // 3. Insurance Details
    const existingIns = ins || storageService.getInsuranceByPatientId(pat.id);
    if (existingIns) {
      setInsuranceProvider(existingIns.insuranceProvider || 'Blue Cross Blue Shield');
      setMemberId(existingIns.memberId || '');
      setPolicyNumber(existingIns.policyNumber || '');
      setPolicyHolderName(existingIns.policyHolderName || `${pat.firstName} ${pat.lastName}`);
      setRelationshipToPatient(existingIns.relationshipToPatient || 'Self');
      setGroupNumber(existingIns.groupNumber || 'GRP-STANDARD-01');
      setEffectiveDate(existingIns.effectiveDate || '2024-01-01');
      setExpiryDate(existingIns.expiryDate || '2024-12-31');

      if (existingIns.billingBreakdown && existingIns.billingBreakdown.length > 0) {
        setBillingBreakdown(existingIns.billingBreakdown);
      } else {
        setBillingBreakdown(DEFAULT_BILLING_SERVICES);
      }

      setRequestedAmount(existingIns.requestedAmount || 2000);
      setInsuranceStatus(existingIns.insuranceStatus || 'Active');
      setEligibilityStatus(existingIns.eligibilityStatus || 'Eligible');
      setCoverageStatus(existingIns.coverageStatus || 'Consultation, Outpatient Care, and Diagnostic Procedures');
      setCopayAmount(existingIns.copayAmount !== undefined ? existingIns.copayAmount : 20);
      setDeductible(existingIns.deductible !== undefined ? existingIns.deductible : 500);
      setCoinsurance(existingIns.coinsurance !== undefined ? existingIns.coinsurance : 20);
      setCoveredServices(
        existingIns.coveredServices || [
          'Outpatient Consultation',
          'Diagnostic Lab Testing',
          'Preventative Screenings',
          'Specialist Consultations'
        ]
      );
      setVerificationResult(existingIns.verificationResult || null);

      const status: ProviderVerificationStatus = existingIns.providerStatus || (existingIns.memberId ? 'Accepted' : 'Accepted');
      setProviderStatus(status);
      setProviderStatusCheckedAt(existingIns.providerStatusCheckedAt || existingIns.updatedAt || new Date().toISOString());
      setProviderStatusReason(
        existingIns.providerStatusReason ||
        (status === 'Accepted'
          ? 'Insurance provider contract verified and active on real-time payer clearinghouse.'
          : status === 'Pending'
          ? 'Insurance provider verification is still pending. Please wait for approval.'
          : 'This insurance provider has declined the request.')
      );
    } else {
      // Clean blank state for fresh patient entry
      setInsuranceProvider('');
      setMemberId('');
      setPolicyNumber('');
      setPolicyHolderName(`${pat.firstName} ${pat.lastName}`.trim());
      setRelationshipToPatient('Self');
      setGroupNumber('');
      setEffectiveDate('');
      setExpiryDate('');
      setBillingBreakdown([]);
      setRequestedAmount(0);
      setInsuranceStatus('Pending Verification');
      setEligibilityStatus('Pending');
      setCoverageStatus('');
      setCopayAmount(0);
      setDeductible(0);
      setCoinsurance(0);
      setCoveredServices([]);
      setVerificationResult(null);
      setProviderStatus('Pending');
      setProviderStatusCheckedAt('');
      setProviderStatusReason('');
    }

    // 4. Load Step 3 Insurance Request Communication
    const existingComm = storageService.getInsuranceCommunicationByPatientId(pat.id);
    if (existingComm) {
      setActiveCommunicationRequest(existingComm);
      if (existingComm.billingBreakdown && existingComm.billingBreakdown.length > 0) {
        setBillingBreakdown(existingComm.billingBreakdown);
      }
      setRequestedAmount(existingComm.requestedAmount || 0);
      if (existingComm.status === 'Approved') {
        setProviderStatus('Accepted');
        setEligibilityStatus('Eligible');
      } else if (existingComm.status === 'Denied') {
        setProviderStatus('Declined');
        setEligibilityStatus('Not Eligible');
      }
    } else {
      setActiveCommunicationRequest(null);
    }
  }, []);

  const loadPatientContext = useCallback(async (patId: string) => {
    try {
      const patient = await patientService.getById(patId);
      if (patient) {
        applyPatientData(patient);
      }
    } catch {
      onError('Failed to load patient context for insurance.');
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
      const results = await insuranceService.searchPatientsForInsurance(query);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: InsuranceSearchResult) => {
    applyPatientData(result.patient, result.appointment, result.registration, result.insurance);
  };

  // Treatment & Billing Breakdown CRUD Handlers
  const handleAddService = () => {
    const newService: TreatmentBillingItem = {
      id: `bill-${Date.now()}`,
      serviceDescription: '',
      procedureCode: 'CPT-99214',
      diagnosisCode: 'ICD-10-R07.9',
      amount: 300
    };
    setBillingBreakdown((prev) => [...prev, newService]);
  };

  const handleUpdateService = (id: string, field: keyof TreatmentBillingItem, value: any) => {
    setBillingBreakdown((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: field === 'amount' ? Math.max(0, parseFloat(value) || 0) : value
        };
      })
    );
  };

  const handleDeleteService = (id: string) => {
    if (billingBreakdown.length <= 1) {
      onError('At least one medical service row is required in the billing breakdown.');
      return;
    }
    setBillingBreakdown((prev) => prev.filter((item) => item.id !== id));
  };

  // STEP 2: Save Insurance Details
  const handleSaveInsurance = async () => {
    setFormError('');
    if (!selectedPatient) {
      setFormError('Please select a patient in Step 1.');
      return;
    }
    if (!memberId.trim() || !policyNumber.trim()) {
      setFormError('Please provide both Member ID and Policy Number in Step 2.');
      return;
    }

    setIsSaving(true);
    try {
      await insuranceService.saveInsurance({
        patientId: selectedPatient.id,
        appointmentId: linkedAppointment?.id,
        insuranceProvider,
        memberId: memberId.trim(),
        policyNumber: policyNumber.trim(),
        policyHolderName: policyHolderName.trim() || `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        relationshipToPatient,
        groupNumber: groupNumber.trim(),
        effectiveDate,
        expiryDate,
        insuranceStatus,
        eligibilityStatus,
        coverageStatus,
        copayAmount,
        deductible,
        coinsurance,
        coveredServices,
        treatmentAmount: totalEstimatedTreatmentAmount,
        requestedAmount: Number(requestedAmount),
        patientResponsibilityAmount,
        billingBreakdown,
        requestId: activeCommunicationRequest?.id,
        providerStatus: providerStatus || 'Accepted',
        providerStatusCheckedAt: providerStatusCheckedAt || new Date().toISOString(),
        providerStatusReason
      });

      onSuccess('Insurance policy and treatment & billing breakdown saved locally.');
    } catch {
      onError('Failed to save insurance details.');
    } finally {
      setIsSaving(false);
    }
  };

  // STEP 3: Send Insurance Request
  const handleSendInsuranceRequest = async () => {
    setFormError('');
    if (!selectedPatient) {
      setFormError('Please select a patient in Step 1 first.');
      return;
    }
    if (!memberId.trim() || !policyNumber.trim()) {
      setFormError('Please fill Member ID and Policy Number in Step 2 before submitting.');
      return;
    }
    if (requestedAmount <= 0) {
      setFormError('Requested insurance coverage amount must be greater than $0.');
      return;
    }
    if (billingBreakdown.length === 0 || totalEstimatedTreatmentAmount <= 0) {
      setFormError('Please include at least one valid medical service in the billing breakdown.');
      return;
    }

    setIsSendingRequest(true);
    try {
      const commReq = await insuranceService.sendInsuranceRequest({
        patientId: selectedPatient.id,
        insuranceProvider,
        memberId: memberId.trim(),
        policyNumber: policyNumber.trim(),
        treatmentAmount: totalEstimatedTreatmentAmount,
        requestedAmount: Number(requestedAmount),
        patientResponsibilityAmount,
        billingBreakdown
      });

      // Also persist insurance details with billing breakdown
      await insuranceService.saveInsurance({
        patientId: selectedPatient.id,
        appointmentId: linkedAppointment?.id,
        insuranceProvider,
        memberId: memberId.trim(),
        policyNumber: policyNumber.trim(),
        policyHolderName: policyHolderName.trim() || `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        relationshipToPatient,
        groupNumber: groupNumber.trim(),
        effectiveDate,
        expiryDate,
        insuranceStatus: 'Active',
        eligibilityStatus: 'Pending',
        coverageStatus,
        copayAmount,
        deductible,
        coinsurance,
        coveredServices,
        treatmentAmount: totalEstimatedTreatmentAmount,
        requestedAmount: Number(requestedAmount),
        patientResponsibilityAmount,
        billingBreakdown,
        requestId: commReq.id,
        providerStatus: 'Accepted',
        providerStatusCheckedAt: new Date().toISOString(),
        providerStatusReason: 'Insurance request submitted with treatment & billing breakdown under review by payer.'
      });

      setActiveCommunicationRequest(commReq);
      setProviderStatus('Pending');
      setProviderStatusReason('Insurance request submitted with treatment & billing breakdown and under review by payer.');
      onSuccess(`✓ Insurance Request #${commReq.id} ($${requestedAmount.toLocaleString()}) submitted to ${insuranceProvider}! Step 3 communication is now unlocked.`);
    } catch {
      onError('Failed to submit insurance request.');
    } finally {
      setIsSendingRequest(false);
    }
  };

  // STEP 3: Chat & Document Upload Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const newAttachments: ChatAttachment[] = files.map((file) => {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      const sizeDisplay = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${(file.size / 1024).toFixed(1)} KB`;
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: sizeDisplay,
        uploadDate: new Date().toISOString()
      };
    });

    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddSampleAttachment = (sampleName: string, sampleSize: string, sampleType: string) => {
    const sampleAtt: ChatAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: sampleName,
      type: sampleType,
      size: sampleSize,
      uploadDate: new Date().toISOString()
    };
    setAttachedFiles((prev) => [...prev, sampleAtt]);
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachedFiles((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleSendMessage = async () => {
    if (!selectedPatient) return;
    if (!chatInputText.trim() && attachedFiles.length === 0) return;

    const messageText = chatInputText.trim() || (attachedFiles.length > 0 ? `Transmitted ${attachedFiles.length} requested clinical/insurance document(s): ${attachedFiles.map(a => a.name).join(', ')}` : '');
    const currentAttachments = [...attachedFiles];

    setIsSendingMessage(true);
    setChatInputText('');
    setAttachedFiles([]);

    try {
      const outcome = await insuranceService.sendChatMessage(selectedPatient.id, {
        text: messageText,
        senderRole: 'Hospital / Admin',
        senderName: 'Hospital Billing Desk',
        attachments: currentAttachments
      });

      setActiveCommunicationRequest({ ...outcome.request });
      onSuccess('Message and documents sent to insurance provider.');

      if (outcome.autoResponseTriggered) {
        setIsSimulatingResponse(true);
        setTimeout(async () => {
          try {
            const payerAutoReply = await insuranceService.sendChatMessage(selectedPatient.id, {
              text: `Documents received: [${currentAttachments.map(a => a.name).join(', ')}]. Our clinical claims committee is reviewing the procedure codes and billing breakdown.`,
              senderRole: 'Insurance Provider',
              senderName: `${outcome.request.insuranceProvider} Claims Specialist`
            });
            setActiveCommunicationRequest({ ...payerAutoReply.request });
          } catch {
            // Ignore background simulation errors
          } finally {
            setIsSimulatingResponse(false);
          }
        }, 1400);
      }
    } catch {
      onError('Failed to send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // STEP 4: Provider Decision / Verification Actions
  const handleSimulateDecision = async (decision: 'Approved' | 'Denied') => {
    if (!selectedPatient) return;
    try {
      const updated = await insuranceService.advanceTimelineDecision(selectedPatient.id, decision);
      setActiveCommunicationRequest({ ...updated });
      if (decision === 'Approved') {
        setProviderStatus('Accepted');
        setEligibilityStatus('Eligible');
        onSuccess(`✓ Insurance Request APPROVED by ${updated.insuranceProvider}! Authorization issued.`);
      } else {
        setProviderStatus('Declined');
        setEligibilityStatus('Not Eligible');
        onError(`✕ Insurance Request DECLINED by ${updated.insuranceProvider}.`);
      }
    } catch {
      onError('Simulation action failed.');
    }
  };

  const handleVerifyInsurance = async () => {
    setFormError('');
    if (!selectedPatient) {
      setFormError('Please select a patient first.');
      return;
    }
    if (!memberId.trim()) {
      setFormError('Please provide a Member ID before verifying insurance.');
      return;
    }

    setIsVerifying(true);
    try {
      const outcome = await insuranceService.verifyInsurance(selectedPatient.id, {
        appointmentId: linkedAppointment?.id,
        insuranceProvider,
        memberId: memberId.trim(),
        policyNumber: policyNumber.trim(),
        policyHolderName: policyHolderName.trim(),
        relationshipToPatient,
        groupNumber: groupNumber.trim(),
        effectiveDate,
        expiryDate,
        insuranceStatus,
        eligibilityStatus,
        coverageStatus,
        copayAmount,
        deductible,
        coinsurance,
        coveredServices,
        treatmentAmount: totalEstimatedTreatmentAmount,
        requestedAmount,
        patientResponsibilityAmount,
        billingBreakdown,
        providerStatus: providerStatus || 'Accepted',
        providerStatusCheckedAt: new Date().toISOString(),
        providerStatusReason
      });

      setVerificationResult(outcome.verificationResult);
      setInsuranceStatus(outcome.insurance.insuranceStatus);
      setEligibilityStatus(outcome.insurance.eligibilityStatus);
      setCoverageStatus(outcome.insurance.coverageStatus);
      setCopayAmount(outcome.insurance.copayAmount);
      setDeductible(outcome.insurance.deductible);
      setCoinsurance(outcome.insurance.coinsurance);
      setProviderStatus(outcome.isVerified ? 'Accepted' : 'Declined');

      if (outcome.isVerified) {
        onSuccess(`Insurance Verified successfully! Active coverage confirmed with ${insuranceProvider}.`);
      } else {
        onError(`Insurance Not Eligible: ${outcome.verificationResult.failureReason || 'Policy check failed.'}`);
      }
    } catch {
      onError('Insurance verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const isStep2Disabled = !selectedPatient;
  const isStep3Disabled = !selectedPatient || !memberId.trim() || !policyNumber.trim();

  const getEligibilityBadge = (status: EligibilityStatus) => {
    switch (status) {
      case 'Eligible':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Eligible & Active' };
      case 'Not Eligible':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', label: 'Not Eligible' };
      default:
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'Pending Verification' };
    }
  };

  const getProviderStatusBadge = (status: ProviderVerificationStatus | null) => {
    switch (status) {
      case 'Accepted':
        return {
          bg: '#dcfce7',
          text: '#15803d',
          border: '#86efac',
          icon: <CheckCircle2 size={14} color="#16a34a" />,
          label: 'Accepted / Approved'
        };
      case 'Pending':
        return {
          bg: '#fef3c7',
          text: '#b45309',
          border: '#fde68a',
          icon: <Clock size={14} color="#d97706" />,
          label: 'Pending'
        };
      case 'Declined':
        return {
          bg: '#fee2e2',
          text: '#b91c1c',
          border: '#fca5a5',
          icon: <XCircle size={14} color="#dc2626" />,
          label: 'Declined'
        };
      default:
        return {
          bg: '#f1f5f9',
          text: '#64748b',
          border: '#cbd5e1',
          icon: <Info size={14} color="#64748b" />,
          label: 'Not Checked'
        };
    }
  };

  const badge = getEligibilityBadge(eligibilityStatus);
  const provBadge = getProviderStatusBadge(providerStatus);

  return (
    <div className="page-body animate-fade-in">
      {/* Top Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#059669', backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: 4 }}>
              Module 3
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Revenue Cycle Management</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Insurance Eligibility & Verification
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
            Prepare policy details and treatment billing breakdown, submit claims request, communicate with payer, and verify coverage parameters.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSendInsuranceRequest}
            disabled={isSendingRequest || isStep3Disabled}
            title={isStep3Disabled ? 'Complete Step 1 and Step 2 to send request' : 'Send Insurance Request to Payer'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: isStep3Disabled ? '#94a3b8' : '#059669',
              cursor: isStep3Disabled ? 'not-allowed' : 'pointer',
              opacity: isStep3Disabled ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
            }}
          >
            <Send size={16} className={isSendingRequest ? 'animate-spin' : ''} />
            <span>{isSendingRequest ? 'Submitting Request...' : 'Send Insurance Request'}</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveInsurance}
            disabled={isSaving || isStep2Disabled}
            title="Save insurance details"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: isStep2Disabled ? '#94a3b8' : '#2563eb',
              cursor: isStep2Disabled ? 'not-allowed' : 'pointer',
              opacity: isStep2Disabled ? 0.7 : 1
            }}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Insurance Info'}</span>
          </button>
          {onNavigateToPriorAuth && selectedPatient && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigateToPriorAuth(selectedPatient.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#059669' }}
            >
              <span>Prior Authorization</span>
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

      {/* Main Grid */}
      <div className="form-main-layout">
        {/* Left Column: Reorganized Workflow Steps Form */}
        <div className="form-column">
          {/* STEP 1 – Search Patient / Appointment */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge">1</div>
                <div>
                  <h2 className="section-title-text" style={{ margin: 0 }}>Search Patient / Appointment</h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Search registered patients using Patient ID, Name, Member ID, or Appointment Code</span>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Lookup by Patient ID, Name, Member ID, or Appointment Code
                </label>
                <div className="form-input-box">
                  <Search size={16} className="form-input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search registered patients (e.g. P10023, Rahul Kumar, APT10001, BCBS-9021882)..."
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
                      Searching insurance records...
                    </div>
                  ) : (
                    searchResults.map((res: InsuranceSearchResult) => (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {res.insurance && (
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontWeight: 700,
                                ...getEligibilityBadge(res.insurance.eligibilityStatus)
                              }}
                            >
                              {res.insurance.eligibilityStatus}
                            </span>
                          )}
                          <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600 }}>Select</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* In-flow message */}
              {searchQuery.trim() !== '' && !isSearching && searchResults.length === 0 && (
                <div
                  className="animate-fade-in"
                  style={{
                    marginTop: 12,
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    color: '#475569',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    lineHeight: 1.4
                  }}
                >
                  <Info size={16} color="#64748b" style={{ flexShrink: 0 }} />
                  <span>No matching patients found.</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2 – Primary Insurance Policy & Request Details */}
          <div
            className="form-section-card"
            style={{
              opacity: isStep2Disabled ? 0.72 : 1,
              transition: 'opacity 0.2s ease'
            }}
          >
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: isStep2Disabled ? '#94a3b8' : '#4f46e5' }}>
                  2
                </div>
                <div>
                  <h2 className="section-title-text" style={{ margin: 0 }}>Primary Insurance Policy & Request Details</h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Enter payer policy, subscriber identifiers, treatment billing breakdown, and coverage parameters</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isStep2Disabled ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 12,
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    <Lock size={13} />
                    Select Patient First
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 12,
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #86efac'
                    }}
                  >
                    <Unlock size={13} />
                    Ready for Request
                  </span>
                )}
              </div>
            </div>

            {isStep2Disabled && (
              <div
                style={{
                  marginBottom: 18,
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  color: '#475569',
                  fontSize: '0.84375rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <Lock size={18} color="#64748b" style={{ flexShrink: 0 }} />
                <span>Please select an existing patient in Step 1 to enter insurance request details.</span>
              </div>
            )}

            {/* Policy & Subscriber Information */}
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">
                  Insurance Provider <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <Building2 size={15} className="form-input-icon" color="#2563eb" />
                  <select
                    className="form-select"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    disabled={isStep2Disabled}
                  >
                    <option value="Blue Cross Blue Shield">Blue Cross Blue Shield</option>
                    <option value="UnitedHealthcare">UnitedHealthcare</option>
                    <option value="Aetna">Aetna Health</option>
                    <option value="Cigna">Cigna Healthcare</option>
                    <option value="Medicare">Medicare Part B</option>
                    <option value="Humana">Humana Choice</option>
                    <option value="Kaiser Permanente">Kaiser Permanente</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Member / Subscriber ID <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input no-icon"
                  placeholder="e.g. BCBS-9021882"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  disabled={isStep2Disabled}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Policy / Plan Number <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input no-icon"
                  placeholder="e.g. POL-77218-01"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  disabled={isStep2Disabled}
                  required
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Policy Holder Name</label>
                <input
                  type="text"
                  className="form-input no-icon"
                  placeholder="e.g. Rahul Kumar"
                  value={policyHolderName}
                  onChange={(e) => setPolicyHolderName(e.target.value)}
                  disabled={isStep2Disabled}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Relationship to Patient</label>
                <select
                  className="form-select no-icon"
                  value={relationshipToPatient}
                  onChange={(e) => setRelationshipToPatient(e.target.value as any)}
                  disabled={isStep2Disabled}
                >
                  <option value="Self">Self (Primary)</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Child">Child / Dependent</option>
                  <option value="Parent">Parent</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Group Number</label>
                <input
                  type="text"
                  className="form-input no-icon"
                  placeholder="e.g. GRP-HEALTH-01"
                  value={groupNumber}
                  onChange={(e) => setGroupNumber(e.target.value)}
                  disabled={isStep2Disabled}
                />
              </div>
            </div>

            <div className="form-grid-2" style={{ marginBottom: 20 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Effective Date</label>
                <div className="form-input-box">
                  <Calendar size={15} className="form-input-icon" />
                  <input
                    type="date"
                    className="form-input"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    disabled={isStep2Disabled}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Expiry / Termination Date</label>
                <div className="form-input-box">
                  <Calendar size={15} className="form-input-icon" />
                  <input
                    type="date"
                    className="form-input"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    disabled={isStep2Disabled}
                  />
                </div>
              </div>
            </div>

            {/* Total Estimated Treatment Amount & Requested Coverage Amount Fields */}
            <div className="form-grid-3" style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 22 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ color: '#0f172a', margin: 0, fontWeight: 700 }}>
                    Estimated Treatment Amount ($)
                  </label>
                </div>
                <div className="form-input-box">
                  <Calculator size={15} className="form-input-icon" color="#2563eb" />
                  <input
                    type="text"
                    className="form-input"
                    value={`$${totalEstimatedTreatmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    disabled
                    style={{ fontWeight: 800, color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: 4, display: 'block' }}>
                  Auto-calculated from billing breakdown
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ color: '#059669', margin: 0, fontWeight: 700 }}>
                    Requested Insurance Coverage ($) <span className="required-star">*</span>
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setRequestedAmount(totalEstimatedTreatmentAmount)}
                      disabled={isStep2Disabled}
                      style={{ fontSize: '0.6875rem', padding: '1px 5px', borderRadius: 3, border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5', color: '#059669', cursor: 'pointer', fontWeight: 600 }}
                      title="Set to 100% of treatment cost"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestedAmount(Math.round(totalEstimatedTreatmentAmount * 0.8))}
                      disabled={isStep2Disabled}
                      style={{ fontSize: '0.6875rem', padding: '1px 5px', borderRadius: 3, border: '1px solid #a7f3d0', backgroundColor: '#ecfdf5', color: '#059669', cursor: 'pointer', fontWeight: 600 }}
                      title="Set to 80% of treatment cost"
                    >
                      80%
                    </button>
                  </div>
                </div>
                <div className="form-input-box">
                  <DollarSign size={15} className="form-input-icon" color="#059669" />
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 2000"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(Number(e.target.value))}
                    disabled={isStep2Disabled}
                    min="1"
                    style={{ fontWeight: 800, color: '#065f46' }}
                  />
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#059669', marginTop: 4, display: 'block' }}>
                  Coverage amount requested from payer
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ color: '#d97706', margin: 0, fontWeight: 700 }}>
                    Patient Responsibility ($)
                  </label>
                </div>
                <div className="form-input-box">
                  <DollarSign size={15} className="form-input-icon" color="#d97706" />
                  <input
                    type="text"
                    className="form-input"
                    value={`$${patientResponsibilityAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    disabled
                    style={{ fontWeight: 800, color: '#b45309', backgroundColor: '#ffffff' }}
                  />
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#b45309', marginTop: 4, display: 'block' }}>
                  Total Treatment − Requested Coverage
                </span>
              </div>
            </div>

            {/* TREATMENT & BILLING BREAKDOWN SECTION */}
            <div style={{ marginTop: 10, paddingTop: 18, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Receipt size={18} color="#2563eb" />
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                      TREATMENT & BILLING BREAKDOWN
                    </h3>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                      {billingBreakdown.length} service row{billingBreakdown.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78125rem', color: '#64748b' }}>
                    Itemized medical services, CPT Procedure Codes, ICD-10 Diagnosis Codes, and service amounts.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAddService}
                    disabled={isStep2Disabled}
                    style={{ padding: '6px 14px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  >
                    <Plus size={14} color="#2563eb" />
                    <span>+ Add Service</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '10px 12px', width: '36%' }}>1. Service / Treatment Description</th>
                      <th style={{ padding: '10px 12px', width: '22%' }}>2. Procedure Code</th>
                      <th style={{ padding: '10px 12px', width: '22%' }}>3. Diagnosis Code</th>
                      <th style={{ padding: '10px 12px', width: '14%', textAlign: 'right' }}>4. Amount ($)</th>
                      <th style={{ padding: '10px 8px', width: '6%', textAlign: 'center' }}>5. Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingBreakdown.map((item, index) => (
                      <tr key={item.id} style={{ borderBottom: index < billingBreakdown.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            className="form-input no-icon"
                            value={item.serviceDescription}
                            onChange={(e) => handleUpdateService(item.id, 'serviceDescription', e.target.value)}
                            placeholder="e.g. Doctor Consultation, Blood Test, X-Ray"
                            disabled={isStep2Disabled}
                            style={{ padding: '6px 10px', fontSize: '0.8125rem', height: 34 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            className="form-input no-icon"
                            value={item.procedureCode}
                            onChange={(e) => handleUpdateService(item.id, 'procedureCode', e.target.value)}
                            placeholder="e.g. CPT-99213, CPT-85025"
                            disabled={isStep2Disabled}
                            style={{ padding: '6px 10px', fontSize: '0.8125rem', height: 34, fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            className="form-input no-icon"
                            value={item.diagnosisCode}
                            onChange={(e) => handleUpdateService(item.id, 'diagnosisCode', e.target.value)}
                            placeholder="e.g. ICD-10-R50.9, ICD-10-D64.9"
                            disabled={isStep2Disabled}
                            style={{ padding: '6px 10px', fontSize: '0.8125rem', height: 34, fontFamily: 'monospace', fontWeight: 600, color: '#7c3aed' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            className="form-input no-icon"
                            value={item.amount}
                            onChange={(e) => handleUpdateService(item.id, 'amount', e.target.value)}
                            disabled={isStep2Disabled}
                            min="0"
                            step="50"
                            style={{ padding: '6px 10px', fontSize: '0.8125rem', textAlign: 'right', height: 34, fontWeight: 700, color: '#0f172a' }}
                          />
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(item.id)}
                            disabled={isStep2Disabled || billingBreakdown.length <= 1}
                            title={billingBreakdown.length <= 1 ? 'Minimum one service row required' : 'Remove row'}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: billingBreakdown.length <= 1 ? 'not-allowed' : 'pointer',
                              color: billingBreakdown.length <= 1 ? '#cbd5e1' : '#ef4444',
                              padding: 4,
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Service Button Below Table */}
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAddService}
                  disabled={isStep2Disabled}
                  style={{ padding: '6px 14px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <Plus size={14} color="#2563eb" />
                  <span>+ Add Service</span>
                </button>
              </div>

              {/* Breakdown Calculation Summary Card Below Table */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 480, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '0.8125rem' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Total Estimated Treatment Amount:</span>
                    <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '0.9375rem' }}>
                      ${totalEstimatedTreatmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '0.8125rem' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Requested Insurance Coverage Amount:</span>
                    <span style={{ fontWeight: 800, color: '#059669', fontSize: '0.9375rem' }}>
                      ${requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #cbd5e1', fontSize: '0.9375rem' }}>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>Patient Responsibility Amount:</span>
                    <span style={{ fontWeight: 800, color: '#b45309', fontSize: '1.0625rem' }}>
                      ${patientResponsibilityAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3 – Insurance Request Communication */}
          <div className="form-section-card" style={{ border: activeCommunicationRequest ? '1px solid #93c5fd' : '1px solid var(--border-light)' }}>
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: '#0284c7' }}>
                  3
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 className="section-title-text" style={{ margin: 0 }}>Insurance Request Communication</h2>
                    {activeCommunicationRequest && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                        {activeCommunicationRequest.id}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Submit insurance claim request with Treatment & Billing Breakdown, monitor status timeline, and communicate with payer
                  </span>
                </div>
              </div>

              {activeCommunicationRequest ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 12,
                    backgroundColor: activeCommunicationRequest.status === 'Approved' ? '#dcfce7' : activeCommunicationRequest.status === 'Denied' ? '#fee2e2' : '#eff6ff',
                    color: activeCommunicationRequest.status === 'Approved' ? '#15803d' : activeCommunicationRequest.status === 'Denied' ? '#b91c1c' : '#1d4ed8',
                    border: `1px solid ${activeCommunicationRequest.status === 'Approved' ? '#86efac' : activeCommunicationRequest.status === 'Denied' ? '#fca5a5' : '#bfdbfe'}`
                  }}
                >
                  Status: {activeCommunicationRequest.status}
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  Ready to Submit
                </span>
              )}
            </div>

            {!activeCommunicationRequest ? (
              <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '24px 16px', textAlign: 'center' }}>
                <MessageSquare size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                <h4 style={{ margin: '0 0 4px', fontSize: '0.9375rem', color: '#334155' }}>
                  Ready to Submit Insurance Request
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#64748b' }}>
                  Click <strong>"Send Insurance Request"</strong> below to submit policy details and Treatment & Billing Breakdown to {insuranceProvider} and unlock real-time communication & tracking.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <span style={{ fontSize: '0.8125rem', color: '#475569' }}>
                    Total Treatment: <strong>${totalEstimatedTreatmentAmount.toLocaleString()}</strong> ({billingBreakdown.length} services)
                  </span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 700 }}>
                    Requested: ${requestedAmount.toLocaleString()}
                  </span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ fontSize: '0.8125rem', color: '#b45309', fontWeight: 700 }}>
                    Patient Resp: ${patientResponsibilityAmount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSendInsuranceRequest}
                    disabled={isStep3Disabled || isSendingRequest}
                    style={{
                      backgroundColor: isStep3Disabled ? '#94a3b8' : '#059669',
                      cursor: isStep3Disabled ? 'not-allowed' : 'pointer',
                      margin: '0 auto'
                    }}
                  >
                    <Send size={15} className={isSendingRequest ? 'animate-spin' : ''} />
                    <span>{isSendingRequest ? 'Submitting Request...' : 'Send Insurance Request'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
                {/* Treatment & Billing Breakdown Summary inside Step 3 */}
                {activeCommunicationRequest.billingBreakdown && activeCommunicationRequest.billingBreakdown.length > 0 && (
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Receipt size={16} color="#0284c7" />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a' }}>
                          Submitted Treatment & Billing Breakdown ({activeCommunicationRequest.billingBreakdown.length} services)
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>
                        Total: ${activeCommunicationRequest.treatmentAmount.toLocaleString()} | Requested: ${activeCommunicationRequest.requestedAmount.toLocaleString()} | Patient Resp: ${(activeCommunicationRequest.patientResponsibilityAmount || 0).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                      {activeCommunicationRequest.billingBreakdown.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.75rem'
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{item.serviceDescription}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.6875rem' }}>
                            <span>
                              <code style={{ color: '#1e40af', fontWeight: 600 }}>{item.procedureCode}</code> | <code style={{ color: '#7c3aed', fontWeight: 600 }}>{item.diagnosisCode}</code>
                            </span>
                            <strong style={{ color: '#059669', fontSize: '0.8125rem' }}>${item.amount.toLocaleString()}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1. Vertical Request Status Timeline */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={18} color="#0284c7" />
                      <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                        Request Status Timeline
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Payer: <strong style={{ color: '#0f172a' }}>{activeCommunicationRequest.insuranceProvider}</strong>
                    </span>
                  </div>

                  <div style={{ position: 'relative', paddingLeft: 6 }}>
                    {activeCommunicationRequest.timeline.map((step: RequestTimelineStep, index: number) => {
                      const isCompleted = step.status === 'completed';
                      const isActive = step.status === 'active';
                      const isLast = index === activeCommunicationRequest.timeline.length - 1;

                      return (
                        <div key={step.stepKey} style={{ display: 'flex', gap: 14, position: 'relative', paddingBottom: isLast ? 0 : 20 }}>
                          {!isLast && (
                            <div
                              style={{
                                position: 'absolute',
                                left: 13,
                                top: 26,
                                bottom: 0,
                                width: 2,
                                backgroundColor: isCompleted ? '#22c55e' : '#e2e8f0'
                              }}
                            />
                          )}

                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              backgroundColor: isCompleted ? '#dcfce7' : isActive ? '#e0f2fe' : '#f1f5f9',
                              border: `2px solid ${isCompleted ? '#22c55e' : isActive ? '#0284c7' : '#cbd5e1'}`,
                              color: isCompleted ? '#15803d' : isActive ? '#0284c7' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              zIndex: 1,
                              boxShadow: isActive ? '0 0 0 4px rgba(2, 132, 199, 0.15)' : 'none'
                            }}
                          >
                            {isCompleted ? (
                              <Check size={14} strokeWidth={3} />
                            ) : isActive ? (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0284c7' }} />
                            ) : (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 700 }}>{index + 1}</span>
                            )}
                          </div>

                          <div style={{ flex: 1, marginTop: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: '0.875rem',
                                    fontWeight: isActive ? 800 : isCompleted ? 700 : 600,
                                    color: isActive ? '#0369a1' : isCompleted ? '#0f172a' : '#64748b'
                                  }}
                                >
                                  {step.title}
                                </span>
                                {step.badgeText && (
                                  <span
                                    style={{
                                      fontSize: '0.6875rem',
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                      fontWeight: 700,
                                      backgroundColor: isCompleted ? '#f0fdf4' : isActive ? '#fef3c7' : '#f8fafc',
                                      color: isCompleted ? '#16a34a' : isActive ? '#b45309' : '#64748b',
                                      border: `1px solid ${isCompleted ? '#bbf7d0' : isActive ? '#fde68a' : '#e2e8f0'}`
                                    }}
                                  >
                                    {step.badgeText}
                                  </span>
                                )}
                              </div>
                              {step.timestamp && (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: isCompleted ? '#475569' : isActive ? '#0f172a' : '#94a3b8', lineHeight: 1.4 }}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Communication with Insurance Provider (Chat) */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                          Communication with Insurance Provider
                        </h3>
                        <div style={{ fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                          {activeCommunicationRequest.insuranceProvider} Claims Specialist (Active)
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleSimulateDecision('Approved')}
                        style={{
                          fontSize: '0.6875rem',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #86efac',
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Simulate Payer Approval
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateDecision('Denied')}
                        style={{
                          fontSize: '0.6875rem',
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #fca5a5',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Simulate Payer Denial
                      </button>
                    </div>
                  </div>

                  {/* Message Stream */}
                  <div
                    style={{
                      padding: 18,
                      maxHeight: 340,
                      overflowY: 'auto',
                      backgroundColor: '#fcfcfd',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14
                    }}
                  >
                    {activeCommunicationRequest.messages.map((msg: ChatMessage) => {
                      const isHospital = msg.senderRole === 'Hospital / Admin';

                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isHospital ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            alignSelf: isHospital ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: '0.75rem', color: '#64748b' }}>
                            <span style={{ fontWeight: 700, color: isHospital ? '#2563eb' : '#0f172a' }}>
                              {msg.sender}
                            </span>
                            <span style={{ fontSize: '0.6875rem', padding: '1px 5px', borderRadius: 4, backgroundColor: isHospital ? '#eff6ff' : '#f1f5f9', color: isHospital ? '#1d4ed8' : '#475569' }}>
                              {msg.senderRole}
                            </span>
                            <span>• {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              backgroundColor: isHospital ? '#eff6ff' : '#ffffff',
                              color: isHospital ? '#1e3a8a' : '#1e293b',
                              border: isHospital ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                              fontSize: '0.84375rem',
                              lineHeight: 1.45,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                              whiteSpace: 'pre-line'
                            }}
                          >
                            <p style={{ margin: 0 }}>{msg.text}</p>

                            {/* Attached Files inside message */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: isHospital ? '1px solid #dbeafe' : '1px solid #f1f5f9' }}>
                                {msg.attachments.map((att: ChatAttachment) => (
                                  <div
                                    key={att.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '4px 8px',
                                      backgroundColor: isHospital ? '#ffffff' : '#f8fafc',
                                      borderRadius: 6,
                                      border: '1px solid #cbd5e1',
                                      fontSize: '0.75rem',
                                      color: '#0f172a',
                                      fontWeight: 600
                                    }}
                                  >
                                    <FileText size={14} color="#2563eb" />
                                    <span>{att.name}</span>
                                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>({att.size})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {isSimulatingResponse && (
                      <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.78125rem' }}>
                        <RefreshCw size={13} className="animate-spin" color="#0284c7" />
                        <span>{activeCommunicationRequest.insuranceProvider} is typing response...</span>
                      </div>
                    )}

                    <div ref={chatMessagesEndRef} />
                  </div>

                  {/* Attached Document Pre-send Tray */}
                  {attachedFiles.length > 0 && (
                    <div style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Attached Documents:</span>
                      {attachedFiles.map((att: ChatAttachment) => (
                        <div
                          key={att.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            backgroundColor: '#ffffff',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.75rem',
                            color: '#0f172a'
                          }}
                        >
                          <FileText size={13} color="#2563eb" />
                          <span style={{ fontWeight: 600 }}>{att.name}</span>
                          <span style={{ color: '#64748b', fontSize: '0.6875rem' }}>({att.size})</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444', display: 'flex', alignItems: 'center' }}
                            title="Remove attachment"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick sample document pills */}
                  <div style={{ padding: '6px 16px', backgroundColor: '#fafafa', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Quick Attach:</span>
                    <button
                      type="button"
                      onClick={() => handleAddSampleAttachment('Insurance_Card_Front_Back.pdf', '1.4 MB', 'application/pdf')}
                      style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', color: '#334155' }}
                    >
                      + Insurance_Card.pdf
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSampleAttachment('Itemized_Treatment_Estimate.docx', '840 KB', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
                      style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', color: '#334155' }}
                    >
                      + Treatment_Estimate.docx
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSampleAttachment('Clinical_Doctor_Notes.pdf', '1.8 MB', 'application/pdf')}
                      style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', color: '#334155' }}
                    >
                      + Doctor_Notes.pdf
                    </button>
                  </div>

                  {/* Chat Input Bar */}
                  <div style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}
                      title="Attach PDF, DOC, DOCX, JPG, PNG"
                    >
                      <Paperclip size={15} color="#4f46e5" />
                      <span>Attach Document</span>
                    </button>

                    <input
                      type="text"
                      className="form-input no-icon"
                      placeholder="Type your message to the insurance provider..."
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      style={{ flex: 1 }}
                    />

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSendMessage}
                      disabled={isSendingMessage || (!chatInputText.trim() && attachedFiles.length === 0)}
                      style={{
                        padding: '9px 18px',
                        backgroundColor: !chatInputText.trim() && attachedFiles.length === 0 ? '#94a3b8' : '#2563eb'
                      }}
                    >
                      <Send size={15} />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 4 – Insurance Provider Verification Result */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: providerStatus === 'Accepted' ? '#16a34a' : providerStatus === 'Declined' ? '#dc2626' : '#d97706' }}>
                  4
                </div>
                <div>
                  <h2 className="section-title-text" style={{ margin: 0 }}>Insurance Provider Verification Result</h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Official electronic response, coverage parameters, and benefit adjudication from {insuranceProvider}
                  </span>
                </div>
              </div>

              {providerStatus && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 12,
                    backgroundColor: provBadge.bg,
                    color: provBadge.text,
                    border: `1px solid ${provBadge.border}`
                  }}
                >
                  {provBadge.icon}
                  {provBadge.label}
                </span>
              )}
            </div>

            {/* Provider Verification Result Card */}
            <div style={{ marginBottom: 20 }}>
              {providerStatus === 'Accepted' && (
                <div
                  className="animate-fade-in"
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}
                >
                  <CheckCircle2 size={22} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: '#14532d', fontSize: '0.9375rem' }}>
                        ✓ Insurance Accepted & Verified
                      </span>
                      {providerStatusCheckedAt && (
                        <span style={{ fontSize: '0.75rem', color: '#166534', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                          Verified: {new Date(providerStatusCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#166534', lineHeight: 1.45 }}>
                      {providerStatusReason || `Active coverage confirmed with ${insuranceProvider}. Real-time EDI 270/271 electronic benefits determination successful.`}
                    </p>
                  </div>
                </div>
              )}

              {providerStatus === 'Pending' && (
                <div
                  className="animate-fade-in"
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}
                >
                  <Clock size={22} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9375rem' }}>
                        ⏳ Insurance Verification Pending
                      </span>
                      {providerStatusCheckedAt && (
                        <span style={{ fontSize: '0.75rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                          Checked: {new Date(providerStatusCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.45, fontWeight: 500 }}>
                      Insurance provider verification is currently in progress. Please review the Step 3 communication timeline for document requests.
                    </p>
                  </div>
                </div>
              )}

              {providerStatus === 'Declined' && (
                <div
                  className="animate-fade-in"
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}
                >
                  <XCircle size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.9375rem' }}>
                        ✕ Insurance Declined
                      </span>
                      {providerStatusCheckedAt && (
                        <span style={{ fontSize: '0.75rem', color: '#991b1b', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                          Checked: {new Date(providerStatusCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#991b1b', lineHeight: 1.45, fontWeight: 500 }}>
                      {providerStatusReason || 'This insurance provider has declined the request. Please verify patient policy identifiers or select an alternate provider.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Coverage Parameters & Adjudication Breakdown */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Insurance Policy Status</label>
                <select
                  className="form-select no-icon"
                  value={insuranceStatus}
                  onChange={(e) => setInsuranceStatus(e.target.value as InsuranceStatus)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="Active">Active (Covered)</option>
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Inactive">Inactive (Suspended by Payer)</option>
                  <option value="Expired">Expired (Lapsed)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Eligibility Status</label>
                <select
                  className="form-select no-icon"
                  value={eligibilityStatus}
                  onChange={(e) => setEligibilityStatus(e.target.value as EligibilityStatus)}
                  style={{ fontWeight: 600 }}
                >
                  <option value="Eligible">Eligible</option>
                  <option value="Pending">Pending</option>
                  <option value="Not Eligible">Not Eligible</option>
                </select>
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">Copay Amount ($)</label>
                <div className="form-input-box">
                  <DollarSign size={15} className="form-input-icon" color="#2563eb" />
                  <input
                    type="number"
                    className="form-input"
                    value={copayAmount}
                    onChange={(e) => setCopayAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Annual Deductible ($)</label>
                <div className="form-input-box">
                  <DollarSign size={15} className="form-input-icon" color="#2563eb" />
                  <input
                    type="number"
                    className="form-input"
                    value={deductible}
                    onChange={(e) => setDeductible(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Coinsurance (%)</label>
                <div className="form-input-box">
                  <span style={{ position: 'absolute', left: 14, color: '#2563eb', fontWeight: 700, fontSize: '0.875rem' }}>%</span>
                  <input
                    type="number"
                    className="form-input"
                    value={coinsurance}
                    onChange={(e) => setCoinsurance(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Covered Medical Services</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {coveredServices.map((srv: string, idx: number) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.8125rem',
                      padding: '4px 10px',
                      borderRadius: 20,
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontWeight: 600
                    }}
                  >
                    <CheckCircle2 size={13} color="#2563eb" />
                    {srv}
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Coverage Summary Note</label>
              <input
                type="text"
                className="form-input no-icon"
                value={coverageStatus}
                onChange={(e) => setCoverageStatus(e.target.value)}
                placeholder="e.g. Consultation, Outpatient Care, and Diagnostic Procedures"
              />
            </div>

            {/* Re-check or Real-time EDI Trigger Button */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Simulate or re-run electronic EDI 270/271 benefits check with {insuranceProvider}.
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleVerifyInsurance}
                disabled={isVerifying}
                style={{ backgroundColor: '#4f46e5' }}
              >
                <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} />
                <span>{isVerifying ? 'Verifying with Payer...' : 'Re-verify with Payer'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Summary Overview Cards */}
        <div className="summary-column">
          {/* PROVIDER VERIFICATION STATUS OVERVIEW */}
          <div className="summary-card animate-fade-in" style={{ marginBottom: 16 }}>
            <div className="summary-card-header">
              <div className="summary-title-wrap">
                <ShieldAlert size={18} color="#2563eb" />
                <span>Provider Decision Overview</span>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: provBadge.bg,
                  color: provBadge.text,
                  border: `1px solid ${provBadge.border}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {provBadge.icon}
                {provBadge.label}
              </span>
            </div>

            <div className="summary-rows-list">
              <div className="summary-row">
                <div className="summary-row-label">
                  <Building2 size={15} /> Provider
                </div>
                <div className="summary-row-val" style={{ fontWeight: 700, color: '#0f172a' }}>
                  {insuranceProvider}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <CreditCard size={15} /> Member ID
                </div>
                <div className="summary-row-val" style={{ fontWeight: 600 }}>
                  {memberId || 'Not Entered'}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <Calculator size={15} color="#2563eb" /> Total Treatment
                </div>
                <div className="summary-row-val" style={{ fontWeight: 700, color: '#0f172a' }}>
                  ${totalEstimatedTreatmentAmount.toLocaleString()}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <DollarSign size={15} color="#059669" /> Requested
                </div>
                <div className="summary-row-val" style={{ fontWeight: 800, color: '#059669' }}>
                  ${requestedAmount.toLocaleString()}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <DollarSign size={15} color="#d97706" /> Patient Resp.
                </div>
                <div className="summary-row-val" style={{ fontWeight: 800, color: '#b45309' }}>
                  ${patientResponsibilityAmount.toLocaleString()}
                </div>
              </div>

              <div className="summary-row">
                <div className="summary-row-label">
                  <Clock size={15} /> Verified At
                </div>
                <div className="summary-row-val" style={{ fontSize: '0.8125rem' }}>
                  {providerStatusCheckedAt
                    ? new Date(providerStatusCheckedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date(providerStatusCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Not Checked'}
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE INSURANCE REQUEST SUMMARY CARD */}
          {activeCommunicationRequest && (
            <div className="summary-card animate-fade-in" style={{ marginBottom: 16, border: '1px solid #bae6fd', background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)' }}>
              <div className="summary-card-header">
                <div className="summary-title-wrap">
                  <FileCheck2 size={18} color="#0284c7" />
                  <span>Active Claim Request</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: 6 }}>
                  {activeCommunicationRequest.status}
                </span>
              </div>

              <div className="summary-rows-list">
                <div className="summary-row">
                  <div className="summary-row-label">
                    <CreditCard size={14} /> Request ID
                  </div>
                  <div className="summary-row-val" style={{ fontWeight: 700, color: '#0f172a' }}>
                    {activeCommunicationRequest.id}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <Calculator size={14} /> Total Cost
                  </div>
                  <div className="summary-row-val" style={{ fontWeight: 600 }}>
                    ${activeCommunicationRequest.treatmentAmount.toLocaleString()}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <DollarSign size={14} color="#059669" /> Requested
                  </div>
                  <div className="summary-row-val" style={{ fontWeight: 800, color: '#059669' }}>
                    ${activeCommunicationRequest.requestedAmount.toLocaleString()}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <DollarSign size={14} color="#d97706" /> Patient Resp.
                  </div>
                  <div className="summary-row-val" style={{ fontWeight: 800, color: '#b45309' }}>
                    ${(activeCommunicationRequest.patientResponsibilityAmount || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REAL-TIME EDI 270/271 ELIGIBILITY RESULT CARD */}
          {verificationResult ? (
            verificationResult.isVerified ? (
              <div
                className="summary-card animate-fade-in"
                style={{
                  border: '1px solid #86efac',
                  background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
                  boxShadow: '0 4px 16px -2px rgba(34, 197, 94, 0.15)',
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#14532d' }}>
                      ✓ Insurance Verified
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#166534' }}>
                      Verified: {new Date(verificationResult.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#166534', margin: '0 0 14px', lineHeight: 1.4 }}>
                  {verificationResult.message}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Copay</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>${copayAmount}</div>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Deductible</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>${deductible}</div>
                  </div>
                  <div style={{ backgroundColor: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Coinsurance</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>{coinsurance}%</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, marginBottom: 6 }}>
                  Coverage Summary:
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#334155', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  {coverageStatus}
                </div>
              </div>
            ) : (
              <div
                className="summary-card animate-fade-in"
                style={{
                  border: '1px solid #fca5a5',
                  background: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)',
                  boxShadow: '0 4px 16px -2px rgba(239, 68, 68, 0.15)',
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <XCircle size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#991b1b' }}>
                      ✕ Insurance Not Eligible
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>
                      Verification Failed
                    </span>
                  </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #fecaca', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', marginBottom: 2 }}>
                    Rejection Reason:
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.4 }}>
                    {verificationResult.failureReason || 'Policy status inactive or invalid subscriber identifier.'}
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                  Please verify member details with patient or contact payer representative.
                </p>
              </div>
            )
          ) : null}

          {/* Patient Profile & Intake Overview */}
          {selectedPatient && (
            <div className="summary-card">
              <div className="summary-card-header">
                <div className="summary-title-wrap">
                  <UserCheck size={18} color="#2563eb" />
                  <span>Patient & Intake Context</span>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`
                  }}
                >
                  {eligibilityStatus}
                </span>
              </div>

              <div className="summary-rows-list">
                <div className="summary-row">
                  <div className="summary-row-label">
                    <User size={15} /> Patient Name
                  </div>
                  <div className="summary-row-val" style={{ fontWeight: 700, color: '#0f172a' }}>
                    {selectedPatient.firstName} {selectedPatient.lastName} ({selectedPatient.patientId})
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <CreditCard size={15} /> Govt ID
                  </div>
                  <div className="summary-row-val">
                    {linkedRegistration ? `${linkedRegistration.idType}: ${linkedRegistration.idNumber}` : 'Pending Intake'}
                  </div>
                </div>

                <div className="summary-row">
                  <div className="summary-row-label">
                    <FileCheck2 size={15} /> Intake Status
                  </div>
                  <div className="summary-row-val" style={{ color: '#2563eb', fontWeight: 600 }}>
                    {linkedRegistration?.registrationStatus || 'Pending'}
                  </div>
                </div>

                {linkedAppointment && (
                  <div className="summary-row">
                    <div className="summary-row-label">
                      <Stethoscope size={15} /> Scheduled Care
                    </div>
                    <div className="summary-row-val" style={{ fontSize: '0.8125rem' }}>
                      {linkedAppointment.doctor.name} ({linkedAppointment.appointmentCode})
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
