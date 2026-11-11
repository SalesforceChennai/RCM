-- ==========================================================
-- MEDICARE RCM POSTGRESQL DATABASE SCHEMA
-- Database: medicare_rcm
-- ==========================================================

-- 1. USERS & AUTHENTICATION
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'User',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CLINICAL DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
  department_id VARCHAR(64) PRIMARY KEY,
  department_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. DOCTORS & PROVIDERS
CREATE TABLE IF NOT EXISTS doctors (
  doctor_id VARCHAR(64) PRIMARY KEY,
  doctor_name VARCHAR(255) NOT NULL,
  specialization VARCHAR(255) NOT NULL,
  department_id VARCHAR(64) REFERENCES departments(department_id) ON DELETE SET NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  availability JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  avatar TEXT,
  room_number VARCHAR(50),
  experience VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PATIENTS
CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(32) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  avatar TEXT,
  blood_group VARCHAR(10),
  emergency_contact VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. APPOINTMENTS & SCHEDULING
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id VARCHAR(64) PRIMARY KEY,
  appointment_code VARCHAR(32) UNIQUE NOT NULL,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id VARCHAR(64) NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
  department_id VARCHAR(64) REFERENCES departments(department_id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  appointment_type VARCHAR(100) NOT NULL DEFAULT 'Consultation',
  status VARCHAR(50) NOT NULL DEFAULT 'Confirmed',
  reason_for_visit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PATIENT REGISTRATIONS
CREATE TABLE IF NOT EXISTS registrations (
  registration_id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id VARCHAR(64) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  id_type VARCHAR(100) NOT NULL DEFAULT 'National ID',
  id_number VARCHAR(100),
  emergency_contact_name VARCHAR(255),
  emergency_contact_relationship VARCHAR(100),
  emergency_contact_phone VARCHAR(50),
  registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  registration_status VARCHAR(50) NOT NULL DEFAULT 'Registered',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INSURANCE ELIGIBILITY & VERIFICATION
CREATE TABLE IF NOT EXISTS insurance (
  insurance_id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_name VARCHAR(255) NOT NULL,
  member_id VARCHAR(100) NOT NULL,
  subscriber_id VARCHAR(100),
  policy_number VARCHAR(100) NOT NULL,
  plan_name VARCHAR(255),
  coverage_status VARCHAR(50) NOT NULL DEFAULT 'Active',
  copay NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  deductible NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  coinsurance NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  coverage_percentage NUMERIC(5, 2) NOT NULL DEFAULT 80.00,
  effective_date DATE,
  expiry_date DATE,
  policy_holder_name VARCHAR(255),
  relationship_to_patient VARCHAR(50) DEFAULT 'Self',
  group_number VARCHAR(100),
  eligibility_status VARCHAR(50) DEFAULT 'Eligible',
  verification_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CHARGE CAPTURE
CREATE TABLE IF NOT EXISTS charges (
  charge_id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id VARCHAR(64) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  doctor_id VARCHAR(64) REFERENCES doctors(doctor_id) ON DELETE SET NULL,
  service_description VARCHAR(255) NOT NULL,
  procedure_code VARCHAR(50) NOT NULL,
  diagnosis_code VARCHAR(50) NOT NULL,
  modifiers VARCHAR(50),
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  charge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  insurance_expected NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  patient_expected NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  insurance_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  patient_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  pending_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  coding_status VARCHAR(50) NOT NULL DEFAULT 'Coded',
  billing_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. MEDICAL CODING
CREATE TABLE IF NOT EXISTS medical_coding (
  coding_id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id VARCHAR(64) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  charge_id VARCHAR(64) REFERENCES charges(charge_id) ON DELETE SET NULL,
  diagnosis_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  procedure_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  coding_status VARCHAR(50) NOT NULL DEFAULT 'READY FOR CLAIM CREATION',
  coding_notes TEXT,
  validation_status VARCHAR(50) NOT NULL DEFAULT 'Complete',
  validation_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. CLAIMS & BATCH TRANSMISSION
CREATE TABLE IF NOT EXISTS claims (
  claim_id VARCHAR(64) PRIMARY KEY,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id VARCHAR(64) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  insurance_id VARCHAR(64) REFERENCES insurance(insurance_id) ON DELETE SET NULL,
  total_billed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  primary_diagnosis_code VARCHAR(50),
  procedure_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  claim_status VARCHAR(50) NOT NULL DEFAULT 'Draft',
  submission_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. CLAIM ADJUDICATION
CREATE TABLE IF NOT EXISTS claim_adjudication (
  adjudication_id VARCHAR(64) PRIMARY KEY,
  claim_id VARCHAR(64) NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  adjudication_status VARCHAR(50) NOT NULL DEFAULT 'Approved',
  allowed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  insurance_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  patient_responsibility NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  adjustment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  denial_code VARCHAR(50),
  denial_reason TEXT,
  adjudication_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PAYMENTS & REMITTANCES
CREATE TABLE IF NOT EXISTS payments (
  payment_id VARCHAR(64) PRIMARY KEY,
  claim_id VARCHAR(64) REFERENCES claims(claim_id) ON DELETE SET NULL,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  payment_type VARCHAR(100) NOT NULL,
  payer VARCHAR(255) NOT NULL,
  payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number VARCHAR(100),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'Completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. DENIAL MANAGEMENT
CREATE TABLE IF NOT EXISTS denials (
  denial_id VARCHAR(64) PRIMARY KEY,
  claim_id VARCHAR(64) NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  denial_code VARCHAR(50) NOT NULL,
  denial_reason TEXT NOT NULL,
  denial_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  denial_status VARCHAR(50) NOT NULL DEFAULT 'Active',
  appeal_status VARCHAR(50) NOT NULL DEFAULT 'Under Review',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. PRIOR AUTHORIZATIONS
CREATE TABLE IF NOT EXISTS prior_authorizations (
  id VARCHAR(64) PRIMARY KEY,
  authorization_request_id VARCHAR(32) UNIQUE NOT NULL,
  patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id VARCHAR(64) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
  service_name VARCHAR(255) NOT NULL,
  procedure_code VARCHAR(50) NOT NULL,
  diagnosis_code VARCHAR(50) NOT NULL,
  doctor_id VARCHAR(64) REFERENCES doctors(doctor_id) ON DELETE SET NULL,
  department_id VARCHAR(64) REFERENCES departments(department_id) ON DELETE SET NULL,
  insurance_provider VARCHAR(255) NOT NULL,
  member_id VARCHAR(100),
  policy_number VARCHAR(100),
  request_date DATE NOT NULL,
  service_date DATE NOT NULL,
  estimated_cost NUMERIC(12, 2),
  medical_justification TEXT,
  supporting_documents JSONB DEFAULT '[]'::jsonb,
  authorization_required BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  authorization_number VARCHAR(100),
  approved_date DATE,
  valid_from DATE,
  valid_until DATE,
  denial_reason TEXT,
  suggested_action TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_insurance_patient ON insurance(patient_id);
CREATE INDEX IF NOT EXISTS idx_charges_patient ON charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_claim ON payments(claim_id);
CREATE INDEX IF NOT EXISTS idx_denials_claim ON denials(claim_id);
