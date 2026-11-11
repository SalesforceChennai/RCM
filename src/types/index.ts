export type Gender = 'Male' | 'Female' | 'Other';

export type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-show';

export type AppointmentType = 'Consultation' | 'Follow-up' | 'Routine Checkup' | 'Specialist Consultation' | 'Emergency';

export type RegistrationStatus = 'Pending' | 'Registered' | 'Verified';

export type IdType = 'National ID' | 'Driver License' | 'Passport' | 'State ID' | 'Social Security Card';

export type InsuranceStatus = 'Active' | 'Inactive' | 'Expired' | 'Pending Verification';

export type EligibilityStatus = 'Eligible' | 'Not Eligible' | 'Pending';

export interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: Gender;
  phone: string;
  email: string;
  address: string;
  avatar?: string;
  bloodGroup?: string;
  emergencyContact?: string;
}

export interface PatientRegistration {
  id: string;
  patientId: string;
  appointmentId?: string;
  idType: IdType;
  idNumber: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  registrationDate: string; // YYYY-MM-DD
  registrationStatus: RegistrationStatus;
  notes?: string;
  updatedAt: string;
}

export interface InsuranceVerificationResult {
  isVerified: boolean;
  verifiedAt: string;
  message: string;
  failureReason?: string;
}

export type ProviderVerificationStatus = 'Accepted' | 'Pending' | 'Declined';

export type RequestTimelineStepKey =
  | 'submitted'
  | 'under_review'
  | 'info_requested'
  | 'docs_submitted'
  | 'decision_pending'
  | 'decision_final';

export type RequestTimelineStepStatus = 'completed' | 'active' | 'upcoming';

export interface RequestTimelineStep {
  stepKey: RequestTimelineStepKey;
  title: string;
  description: string;
  timestamp?: string;
  status: RequestTimelineStepStatus;
  badgeText?: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  type: string; // e.g. "application/pdf", "image/png"
  size: string; // e.g. "2.4 MB"
  uploadDate: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderRole: 'Hospital / Admin' | 'Insurance Provider';
  text: string;
  timestamp: string;
  attachments?: ChatAttachment[];
}

export type InsuranceRequestOverallStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Additional Info Requested'
  | 'Documents Submitted'
  | 'Decision Pending'
  | 'Approved'
  | 'Denied';

export type TreatmentCategory =
  | 'Consultation'
  | 'Laboratory Test'
  | 'Diagnostic Test'
  | 'Procedure / Surgery'
  | 'Medication / Pharmacy'
  | 'Room & Nursing Care'
  | 'Therapy & Rehabilitation'
  | 'Other Service';

export interface TreatmentCostItem {
  id: string;
  serviceName: string;
  category: TreatmentCategory;
  quantity: number;
  unitCost: number;
  totalCost: number;
  description?: string;
}

export interface TreatmentBillingItem {
  id: string;
  serviceDescription: string;
  procedureCode: string; // e.g. "CPT-99213"
  diagnosisCode: string; // e.g. "ICD-10-R50.9"
  amount: number;
}

export interface InsuranceCommunicationRequest {
  id: string; // requestId e.g. "REQ-BCBS-10492"
  patientId: string;
  insuranceProvider: string;
  memberId: string;
  policyNumber: string;
  treatmentAmount: number;
  requestedAmount: number;
  patientResponsibilityAmount?: number;
  additionalCharges?: number;
  treatmentBreakdown?: TreatmentCostItem[];
  billingBreakdown?: TreatmentBillingItem[];
  status: InsuranceRequestOverallStatus;
  submittedAt: string;
  timeline: RequestTimelineStep[];
  messages: ChatMessage[];
  updatedAt: string;
}

export interface InsuranceInfo {
  id: string;
  patientId: string;
  appointmentId?: string;
  insuranceProvider: string;
  memberId: string;
  policyNumber: string;
  policyHolderName: string;
  relationshipToPatient: 'Self' | 'Spouse' | 'Child' | 'Parent' | 'Other';
  groupNumber: string;
  effectiveDate: string;
  expiryDate: string;
  insuranceStatus: InsuranceStatus;
  eligibilityStatus: EligibilityStatus;
  coverageStatus: string;
  copayAmount: number;
  deductible: number;
  coinsurance: number;
  coveredServices: string[];
  verificationResult?: InsuranceVerificationResult;
  providerStatus?: ProviderVerificationStatus;
  providerStatusCheckedAt?: string;
  providerStatusReason?: string;
  treatmentAmount?: number;
  requestedAmount?: number;
  patientResponsibilityAmount?: number;
  additionalCharges?: number;
  treatmentBreakdown?: TreatmentCostItem[];
  billingBreakdown?: TreatmentBillingItem[];
  requestId?: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
  avatar: string;
  specialization: string;
  workingHours: {
    start: string; // e.g. "09:00 AM"
    end: string;   // e.g. "05:00 PM"
  };
  roomNumber?: string;
  experience?: string;
}

export interface Department {
  id: string;
  name: string;
  icon: string; // 'heart' | 'bone' | 'sparkles' | 'brain' | 'baby' | 'stethoscope' | 'activity' | 'shield' | 'alert-triangle' | 'eye' | 'smile' | 'wind' | 'camera' | etc.
  color: string;
  description?: string;
  status?: string;
  doctorCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Appointment {
  id: string;
  appointmentCode: string; // e.g. "APT10001"
  patientId: string;
  patient: {
    id: string;
    patientCode: string;
    name: string;
    phone: string;
    avatar?: string;
    gender: Gender;
    dob: string;
    email: string;
    address: string;
  };
  doctorId: string;
  doctor: {
    id: string;
    name: string;
    avatar: string;
    department: string;
  };
  departmentId: string;
  departmentName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // e.g. "09:00 AM", "10:30 AM"
  durationMinutes: number; // e.g. 15, 30, 45, 60
  appointmentType: AppointmentType;
  status: AppointmentStatus;
  reasonForVisit: string;
  notes?: string;
  createdAt: string;
}

export interface TimeSlot {
  time: string;
  status: 'Available' | 'Booked' | 'Selected';
}

export interface DashboardStats {
  todayAppointmentsCount: number;
  upcomingAppointmentsCount: number;
  completedAppointmentsCount: number;
  cancelledAppointmentsCount: number;
  noShowAppointmentsCount: number;
}

export type PriorAuthStatus = 'Draft' | 'Pending' | 'Approved' | 'Denied' | 'Expired' | 'Not Required';

export interface PriorAuthorization {
  id: string;
  authorizationRequestId: string; // e.g. "PA-10001"
  patientId: string;
  appointmentId?: string;
  serviceName: string;
  procedureCode: string; // e.g. "CPT 70551"
  diagnosisCode: string; // e.g. "ICD M54.5"
  doctorId: string;
  doctorName?: string;
  departmentId?: string;
  departmentName?: string;
  insuranceProvider: string;
  memberId?: string;
  policyNumber?: string;
  requestDate: string; // YYYY-MM-DD
  serviceDate: string; // YYYY-MM-DD
  estimatedCost?: number;
  medicalJustification: string;
  supportingDocuments?: string[];
  authorizationRequired: boolean;
  status: PriorAuthStatus;
  authorizationNumber?: string;
  approvedDate?: string;
  validFrom?: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  denialReason?: string;
  suggestedAction?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CodingStatus = 'Coded' | 'Pending Coding' | 'Missing Code' | 'Coding Audit Required';
export type BillingStatus = 'Pending' | 'Partial Payment' | 'Paid in Full' | 'Unbilled' | 'Submitted' | 'Rejected';

export interface ChargeCaptureItem {
  id: string;
  serviceDescription: string;
  category?: string; // e.g. "Consultation", "Laboratory Test", "Diagnostic Test", "Medication", "Procedure"
  procedureCode: string; // e.g. "CPT-99213"
  diagnosisCode: string; // e.g. "ICD-10-R50.9"
  modifiers?: string; // e.g. "25", "59"
  quantity: number; // e.g. 1
  unitRate: number; // e.g. 1000
  totalCharge: number; // quantity * unitRate
  insuranceExpected?: number; // e.g. 800
  patientExpected?: number; // e.g. 200
  insurancePaid?: number; // e.g. 800
  patientPaid?: number; // e.g. 100
  pendingAmount?: number; // totalCharge - insurancePaid - patientPaid
  codingStatus?: CodingStatus; // e.g. 'Coded', 'Pending Coding', 'Missing Code'
  billingStatus?: BillingStatus; // e.g. 'Pending', 'Partial Payment', 'Unbilled', 'Paid in Full'
}

export interface ChargePaymentRecord {
  id: string; // e.g. "PAY-001"
  source: 'Insurance' | 'Patient';
  paymentType: string; // e.g. "Insurance Payment", "Patient Payment", "Copay"
  amount: number;
  paymentDate: string; // e.g. "10-09-2026" or "2026-09-10" or ""
  status: 'Pending' | 'Completed' | 'Partial Paid';
  referenceNumber: string; // e.g. "INS-REF-001", "PAT-REF-001"
  notes?: string;
}

export interface ChargeCaptureEncounter {
  id: string;
  patientId: string;
  appointmentId?: string;
  encounterDate: string;
  visitType?: string; // e.g. "Outpatient Consultation"
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  insuranceProvider: string;
  memberId: string;
  policyNumber: string;
  insuranceVerificationStatus?: string;
  claimStatus: 'Draft' | 'Ready to Bill' | 'Billed' | 'Paid in Full' | 'Partial Paid';
  items: ChargeCaptureItem[];
  payments?: ChargePaymentRecord[];
  totalCharges: number;
  expectedInsuranceCoverage: number;
  insuranceReceived: number;
  insurancePending: number;
  patientResponsibility: number;
  patientPaid: number;
  patientPending: number;
  totalOutstandingAR: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentFilterParams {
  searchQuery?: string;
  doctorId?: string;
  departmentId?: string;
  status?: AppointmentStatus | 'All';
  date?: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
  page?: number;
  limit?: number;
}

export type CodingValidationLevel = 'Complete' | 'Review' | 'Error';

export interface CodingValidationItem {
  id: string;
  level: CodingValidationLevel;
  title: string;
  message: string;
  serviceId?: string;
  code?: string;
}

export interface DiagnosisCodeItem {
  id: string;
  type: 'Primary' | 'Secondary';
  code: string;
  description: string;
  status: 'Active' | 'Validated' | 'Pending Review';
  isPrimary?: boolean;
}

export interface ProcedureCodeItem {
  id: string;
  serviceId?: string;
  serviceDescription: string;
  serviceDate?: string;
  cptCode: string;
  modifier?: string;
  units: number;
  chargeAmount: number;
  codingStatus: 'Ready' | 'Needs Review' | 'Pending' | 'Completed';
}

export interface MedicalCodingRecord {
  id: string;
  encounterId: string;
  patientId: string;
  appointmentId?: string;
  encounterDate: string;
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  services: ChargeCaptureItem[];
  diagnoses: DiagnosisCodeItem[];
  procedures: ProcedureCodeItem[];
  codingStatus: 'READY FOR CLAIM CREATION' | 'IN PROGRESS' | 'REQUIRES ATTENTION' | 'DRAFT';
  validationMessages?: CodingValidationItem[];
  notes?: string;
  updatedAt: string;
}

export * from './paymentPrediction';
