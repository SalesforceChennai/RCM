import type { Patient, Doctor, Department, Appointment, PatientRegistration, InsuranceInfo, PriorAuthorization, InsuranceCommunicationRequest, ChargeCaptureEncounter, MedicalCodingRecord } from '../types';
import {
  INITIAL_PATIENTS,
  INITIAL_DOCTORS,
  INITIAL_DEPARTMENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_REGISTRATIONS,
  INITIAL_INSURANCES,
  INITIAL_PRIOR_AUTHORIZATIONS,
  INITIAL_INSURANCE_COMMUNICATIONS,
  INITIAL_CHARGE_CAPTURES
} from '../data/mockData';

const STORAGE_KEYS = {
  PATIENTS: 'medicare_rcm_patients_v2',
  DOCTORS: 'medicare_rcm_doctors_v2',
  DEPARTMENTS: 'medicare_rcm_departments_v2',
  APPOINTMENTS: 'medicare_rcm_appointments_v2',
  REGISTRATIONS: 'medicare_rcm_registrations_v2',
  INSURANCE: 'medicare_rcm_insurance_v2',
  PRIOR_AUTHORIZATIONS: 'medicare_rcm_prior_authorizations_v2',
  INSURANCE_COMMUNICATIONS: 'medicare_rcm_insurance_communications_v2',
  CHARGE_CAPTURES: 'medicare_rcm_charge_captures_v2',
  MEDICAL_CODINGS: 'medicare_rcm_medical_codings_v2',
  APP_DATE: 'medicare_rcm_current_date_v2',
};

// Purge legacy sample data keys from localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  [
    'medicare_rcm_patients_v1',
    'medicare_rcm_doctors_v1',
    'medicare_rcm_departments_v1',
    'medicare_rcm_appointments_v1',
    'medicare_rcm_registrations_v1',
    'medicare_rcm_insurance_v1',
    'medicare_rcm_prior_authorizations_v1',
    'medicare_rcm_insurance_communications_v1',
    'medicare_rcm_charge_captures_v1',
    'medicare_rcm_medical_codings_v1',
    'medicare_rcm_current_date_v1',
  ].forEach((k) => localStorage.removeItem(k));
}

export const storageService = {
  getPatients(): Patient[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (!raw) {
      this.setPatients(INITIAL_PATIENTS);
      return INITIAL_PATIENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_PATIENTS;
    }
  },

  setPatients(patients: Patient[]): void {
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  },

  getDoctors(): Doctor[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCTORS);
    if (!raw) {
      this.setDoctors(INITIAL_DOCTORS);
      return INITIAL_DOCTORS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_DOCTORS;
    }
  },

  setDoctors(doctors: Doctor[]): void {
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
  },

  getDepartments(): Department[] {
    const raw = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
    if (!raw) {
      this.setDepartments(INITIAL_DEPARTMENTS);
      return INITIAL_DEPARTMENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_DEPARTMENTS;
    }
  },

  setDepartments(departments: Department[]): void {
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
  },

  getAppointments(): Appointment[] {
    const raw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (!raw) {
      this.setAppointments(INITIAL_APPOINTMENTS);
      return INITIAL_APPOINTMENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_APPOINTMENTS;
    }
  },

  setAppointments(appointments: Appointment[]): void {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  },

  getRegistrations(): PatientRegistration[] {
    const raw = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
    if (!raw) {
      this.setRegistrations(INITIAL_REGISTRATIONS);
      return INITIAL_REGISTRATIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_REGISTRATIONS;
    }
  },

  setRegistrations(registrations: PatientRegistration[]): void {
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(registrations));
  },

  getRegistrationByPatientId(patientId: string): PatientRegistration | null {
    const list = this.getRegistrations();
    return list.find((r) => r.patientId === patientId) || null;
  },

  saveRegistration(reg: PatientRegistration): void {
    const list = this.getRegistrations();
    const idx = list.findIndex((r) => r.patientId === reg.patientId || r.id === reg.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...reg, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(reg);
    }
    this.setRegistrations(list);
  },

  getInsuranceList(): InsuranceInfo[] {
    const raw = localStorage.getItem(STORAGE_KEYS.INSURANCE);
    if (!raw) {
      this.setInsuranceList(INITIAL_INSURANCES);
      return INITIAL_INSURANCES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_INSURANCES;
    }
  },

  setInsuranceList(insuranceList: InsuranceInfo[]): void {
    localStorage.setItem(STORAGE_KEYS.INSURANCE, JSON.stringify(insuranceList));
  },

  getInsuranceByPatientId(patientId: string): InsuranceInfo | null {
    const list = this.getInsuranceList();
    return list.find((i) => i.patientId === patientId) || null;
  },

  saveInsurance(ins: InsuranceInfo): void {
    const list = this.getInsuranceList();
    const idx = list.findIndex((i) => i.patientId === ins.patientId || i.id === ins.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...ins, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(ins);
    }
    this.setInsuranceList(list);
  },

  getPriorAuthorizations(): PriorAuthorization[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PRIOR_AUTHORIZATIONS);
    if (!raw) {
      this.setPriorAuthorizations(INITIAL_PRIOR_AUTHORIZATIONS);
      return INITIAL_PRIOR_AUTHORIZATIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_PRIOR_AUTHORIZATIONS;
    }
  },

  setPriorAuthorizations(list: PriorAuthorization[]): void {
    localStorage.setItem(STORAGE_KEYS.PRIOR_AUTHORIZATIONS, JSON.stringify(list));
  },

  getPriorAuthByPatientId(patientId: string): PriorAuthorization[] {
    const list = this.getPriorAuthorizations();
    return list.filter((p) => p.patientId === patientId);
  },

  getPriorAuthById(id: string): PriorAuthorization | null {
    const list = this.getPriorAuthorizations();
    return list.find((p) => p.id === id || p.authorizationRequestId.toLowerCase() === id.toLowerCase()) || null;
  },

  savePriorAuthorization(auth: PriorAuthorization): void {
    const list = this.getPriorAuthorizations();
    const idx = list.findIndex((p) => p.id === auth.id || p.authorizationRequestId === auth.authorizationRequestId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...auth, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(auth);
    }
    this.setPriorAuthorizations(list);
  },

  getInsuranceCommunications(): InsuranceCommunicationRequest[] {
    const raw = localStorage.getItem(STORAGE_KEYS.INSURANCE_COMMUNICATIONS);
    if (!raw) {
      this.setInsuranceCommunications(INITIAL_INSURANCE_COMMUNICATIONS);
      return INITIAL_INSURANCE_COMMUNICATIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_INSURANCE_COMMUNICATIONS;
    }
  },

  setInsuranceCommunications(list: InsuranceCommunicationRequest[]): void {
    localStorage.setItem(STORAGE_KEYS.INSURANCE_COMMUNICATIONS, JSON.stringify(list));
  },

  getInsuranceCommunicationByPatientId(patientId: string): InsuranceCommunicationRequest | null {
    const list = this.getInsuranceCommunications();
    return list.find((c) => c.patientId === patientId) || null;
  },

  saveInsuranceCommunication(req: InsuranceCommunicationRequest): void {
    const list = this.getInsuranceCommunications();
    const idx = list.findIndex((c) => c.id === req.id || c.patientId === req.patientId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...req, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(req);
    }
    this.setInsuranceCommunications(list);
  },

  deletePriorAuthorization(id: string): void {
    const list = this.getPriorAuthorizations();
    const filtered = list.filter((p) => p.id !== id && p.authorizationRequestId !== id);
    this.setPriorAuthorizations(filtered);
  },

  getChargeCaptures(): ChargeCaptureEncounter[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CHARGE_CAPTURES);
    if (!raw) {
      this.setChargeCaptures(INITIAL_CHARGE_CAPTURES);
      return INITIAL_CHARGE_CAPTURES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_CHARGE_CAPTURES;
    }
  },

  setChargeCaptures(list: ChargeCaptureEncounter[]): void {
    localStorage.setItem(STORAGE_KEYS.CHARGE_CAPTURES, JSON.stringify(list));
  },

  getChargeCaptureByPatientId(patientId: string): ChargeCaptureEncounter | null {
    const list = this.getChargeCaptures();
    return list.find((c) => c.patientId === patientId) || null;
  },

  saveChargeCapture(record: ChargeCaptureEncounter): void {
    const list = this.getChargeCaptures();
    const idx = list.findIndex((c) => c.id === record.id || c.patientId === record.patientId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(record);
    }
    this.setChargeCaptures(list);
  },

  getMedicalCodings(): MedicalCodingRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDICAL_CODINGS);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  setMedicalCodings(list: MedicalCodingRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.MEDICAL_CODINGS, JSON.stringify(list));
  },

  getMedicalCodingByPatientId(patientId: string): MedicalCodingRecord | null {
    const list = this.getMedicalCodings();
    return list.find((m) => m.patientId === patientId) || null;
  },

  saveMedicalCoding(record: MedicalCodingRecord): void {
    const list = this.getMedicalCodings();
    const idx = list.findIndex((m) => m.id === record.id || m.patientId === record.patientId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record, updatedAt: new Date().toISOString() };
    } else {
      list.unshift(record);
    }
    this.setMedicalCodings(list);
  },

  getCurrentDate(): string {
    return localStorage.getItem(STORAGE_KEYS.APP_DATE) || new Date().toISOString().split('T')[0];
  },

  setCurrentDate(date: string): void {
    localStorage.setItem(STORAGE_KEYS.APP_DATE, date);
  },

  resetAllToDefault(): void {
    this.setPatients(INITIAL_PATIENTS);
    this.setDoctors(INITIAL_DOCTORS);
    this.setDepartments(INITIAL_DEPARTMENTS);
    this.setAppointments(INITIAL_APPOINTMENTS);
    this.setRegistrations(INITIAL_REGISTRATIONS);
    this.setInsuranceList(INITIAL_INSURANCES);
    this.setPriorAuthorizations(INITIAL_PRIOR_AUTHORIZATIONS);
    this.setInsuranceCommunications(INITIAL_INSURANCE_COMMUNICATIONS);
    this.setChargeCaptures(INITIAL_CHARGE_CAPTURES);
    this.setCurrentDate(new Date().toISOString().split('T')[0]);
  }
};
