import type {
  Patient,
  Doctor,
  Department,
  Appointment,
  PatientRegistration,
  InsuranceInfo,
  PriorAuthorization,
  InsuranceCommunicationRequest,
  ChargeCaptureEncounter
} from '../types';

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'dept-cardio', name: 'Cardiology', icon: 'heart', color: '#EF4444', description: 'Heart & cardiovascular care' },
  { id: 'dept-ortho', name: 'Orthopedics', icon: 'bone', color: '#06B6D4', description: 'Bones, joints & spine' },
  { id: 'dept-derm', name: 'Dermatology', icon: 'sparkles', color: '#EC4899', description: 'Skin, hair & nail conditions' },
  { id: 'dept-neuro', name: 'Neurology', icon: 'brain', color: '#8B5CF6', description: 'Brain & nervous system' },
  { id: 'dept-ped', name: 'Pediatrics', icon: 'baby', color: '#F59E0B', description: 'Infant, child & teen health' },
  { id: 'dept-gen', name: 'General Medicine', icon: 'stethoscope', color: '#10B981', description: 'Primary & family care' },
];

export const INITIAL_DOCTORS: Doctor[] = [];

export const INITIAL_PATIENTS: Patient[] = [];

export const INITIAL_APPOINTMENTS: Appointment[] = [];

export const INITIAL_REGISTRATIONS: PatientRegistration[] = [];

export const INITIAL_INSURANCES: InsuranceInfo[] = [];

export const INITIAL_PRIOR_AUTHORIZATIONS: PriorAuthorization[] = [];

export const INITIAL_INSURANCE_COMMUNICATIONS: InsuranceCommunicationRequest[] = [];

export const INITIAL_CHARGE_CAPTURES: ChargeCaptureEncounter[] = [];
