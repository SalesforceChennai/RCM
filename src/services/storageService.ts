// Local mock data storage has been removed.
// All clinical and RCM data is stored and retrieved exclusively via Neon PostgreSQL /api/* endpoints.

const LEGACY_KEYS = [
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
  'medicare_rcm_patients_v2',
  'medicare_rcm_doctors_v2',
  'medicare_rcm_departments_v2',
  'medicare_rcm_appointments_v2',
  'medicare_rcm_registrations_v2',
  'medicare_rcm_insurance_v2',
  'medicare_rcm_prior_authorizations_v2',
  'medicare_rcm_insurance_communications_v2',
  'medicare_rcm_charge_captures_v2',
  'medicare_rcm_medical_codings_v2',
  'medicare_rcm_current_date_v2',
  'medicare_rcm_patients_v3',
  'medicare_rcm_doctors_v3',
  'medicare_rcm_departments_v3',
  'medicare_rcm_appointments_v3',
  'medicare_rcm_registrations_v3',
  'medicare_rcm_insurance_v3',
  'medicare_rcm_prior_authorizations_v3',
  'medicare_rcm_insurance_communications_v3',
  'medicare_rcm_charge_captures_v3',
  'medicare_rcm_medical_codings_v3',
  'medicare_rcm_current_date_v3',
  'medicare_rcm_custom_claims_v1',
  'medicare_rcm_claims_registry_v2',
  'medicare_rcm_claims_registry_v3',
];

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
}

export const storageService = {
  getCurrentDate(): string {
    const now = new Date();
    return (
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0')
    );
  },
};
