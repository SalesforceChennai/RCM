import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

// Load environment variables from server/.env or root .env
const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
const rootEnvPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL;
const host = process.env.PGHOST || 'localhost';
const port = parseInt(process.env.PGPORT || '5432', 10);
const user = process.env.PGUSER || 'postgres';
const password = process.env.PGPASSWORD || '';
const database = process.env.PGDATABASE || 'rcm_database';

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host,
        port,
        user,
        password,
        database,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[PostgreSQL] Executed query: ${text.slice(0, 60)}... (${duration}ms)`);
  }
  return res;
}

export async function checkConnection(): Promise<{ connected: boolean; database: string; error?: string }> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1;');
      return { connected: true, database };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      connected: false,
      database,
      error: err?.message || 'Failed to connect to PostgreSQL',
    };
  }
}

/**
 * Initializes all required database tables matching the RCM application data models.
 */
export async function initDatabase(): Promise<boolean> {
  const connCheck = await checkConnection();
  if (!connCheck.connected) {
    console.warn(`[PostgreSQL] Connection check failed: ${connCheck.error}`);
    return false;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 1. Departments
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(64),
        color VARCHAR(64),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Doctors
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
        department_name VARCHAR(255),
        avatar TEXT,
        specialization VARCHAR(255),
        working_hours JSONB,
        room_number VARCHAR(50),
        experience VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Patients
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id VARCHAR(64) PRIMARY KEY,
        patient_id VARCHAR(64) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        dob VARCHAR(50) NOT NULL,
        gender VARCHAR(20) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        address TEXT,
        avatar TEXT,
        blood_group VARCHAR(20),
        emergency_contact VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Appointments
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(64) PRIMARY KEY,
        appointment_code VARCHAR(64) UNIQUE NOT NULL,
        patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id VARCHAR(64) REFERENCES doctors(id) ON DELETE SET NULL,
        department_id VARCHAR(64) REFERENCES departments(id) ON DELETE SET NULL,
        department_name VARCHAR(255),
        appointment_date VARCHAR(50) NOT NULL,
        appointment_time VARCHAR(50) NOT NULL,
        duration_minutes INT DEFAULT 30,
        appointment_type VARCHAR(100) DEFAULT 'Consultation',
        status VARCHAR(50) DEFAULT 'Confirmed',
        reason_for_visit TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Registrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id VARCHAR(64) PRIMARY KEY,
        patient_id VARCHAR(64) UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id VARCHAR(64),
        id_type VARCHAR(100) NOT NULL DEFAULT 'National ID',
        id_number VARCHAR(100),
        emergency_contact_name VARCHAR(255),
        emergency_contact_relationship VARCHAR(100),
        emergency_contact_phone VARCHAR(50),
        registration_date VARCHAR(50),
        registration_status VARCHAR(50) DEFAULT 'Registered',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 6. Insurance & Eligibility
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance (
        id VARCHAR(64) PRIMARY KEY,
        patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id VARCHAR(64),
        insurance_provider VARCHAR(255) NOT NULL,
        member_id VARCHAR(100) NOT NULL,
        policy_number VARCHAR(100) NOT NULL,
        policy_holder_name VARCHAR(255),
        relationship_to_patient VARCHAR(50) DEFAULT 'Self',
        group_number VARCHAR(100),
        effective_date VARCHAR(50),
        expiry_date VARCHAR(50),
        insurance_status VARCHAR(50) DEFAULT 'Active',
        eligibility_status VARCHAR(50) DEFAULT 'Eligible',
        coverage_status VARCHAR(100),
        copay_amount NUMERIC(10, 2) DEFAULT 0.00,
        deductible NUMERIC(10, 2) DEFAULT 0.00,
        coinsurance NUMERIC(5, 2) DEFAULT 0.00,
        covered_services JSONB DEFAULT '[]'::jsonb,
        verification_result JSONB,
        provider_status VARCHAR(50),
        provider_status_checked_at TIMESTAMPTZ,
        provider_status_reason TEXT,
        treatment_amount NUMERIC(12, 2),
        requested_amount NUMERIC(12, 2),
        patient_responsibility_amount NUMERIC(12, 2),
        additional_charges NUMERIC(12, 2),
        treatment_breakdown JSONB DEFAULT '[]'::jsonb,
        billing_breakdown JSONB DEFAULT '[]'::jsonb,
        request_id VARCHAR(64),
        timeline JSONB DEFAULT '[]'::jsonb,
        messages JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 7. Charges & Billing Encounters
    await client.query(`
      CREATE TABLE IF NOT EXISTS charges (
        id VARCHAR(64) PRIMARY KEY,
        patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id VARCHAR(64),
        encounter_date VARCHAR(50),
        visit_type VARCHAR(100),
        doctor_id VARCHAR(64),
        doctor_name VARCHAR(255),
        department_id VARCHAR(64),
        department_name VARCHAR(255),
        insurance_provider VARCHAR(255),
        member_id VARCHAR(100),
        policy_number VARCHAR(100),
        insurance_verification_status VARCHAR(100),
        claim_status VARCHAR(50) DEFAULT 'Draft',
        items JSONB DEFAULT '[]'::jsonb,
        payments JSONB DEFAULT '[]'::jsonb,
        total_charges NUMERIC(12, 2) DEFAULT 0.00,
        expected_insurance_coverage NUMERIC(12, 2) DEFAULT 0.00,
        insurance_received NUMERIC(12, 2) DEFAULT 0.00,
        insurance_pending NUMERIC(12, 2) DEFAULT 0.00,
        patient_responsibility NUMERIC(12, 2) DEFAULT 0.00,
        patient_paid NUMERIC(12, 2) DEFAULT 0.00,
        patient_pending NUMERIC(12, 2) DEFAULT 0.00,
        total_outstanding_ar NUMERIC(12, 2) DEFAULT 0.00,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 8. Medical Coding
    await client.query(`
      CREATE TABLE IF NOT EXISTS medical_coding (
        id VARCHAR(64) PRIMARY KEY,
        encounter_id VARCHAR(64),
        patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id VARCHAR(64),
        encounter_date VARCHAR(50),
        doctor_id VARCHAR(64),
        doctor_name VARCHAR(255),
        department_id VARCHAR(64),
        department_name VARCHAR(255),
        services JSONB DEFAULT '[]'::jsonb,
        diagnoses JSONB DEFAULT '[]'::jsonb,
        procedures JSONB DEFAULT '[]'::jsonb,
        coding_status VARCHAR(100) DEFAULT 'READY FOR CLAIM CREATION',
        validation_messages JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 9. Claims
    await client.query(`
      CREATE TABLE IF NOT EXISTS claims (
        claim_id VARCHAR(64) PRIMARY KEY,
        patient_id VARCHAR(64),
        patient_name VARCHAR(255),
        patient_age INT,
        gender VARCHAR(20),
        department VARCHAR(255),
        doctor VARCHAR(255),
        insurance_provider VARCHAR(255),
        claim_amount NUMERIC(12, 2) DEFAULT 0.00,
        procedure_code VARCHAR(100),
        procedure_description TEXT,
        diagnosis_code VARCHAR(100),
        diagnosis_description TEXT,
        number_of_procedures INT DEFAULT 1,
        previous_claims_count INT DEFAULT 0,
        previous_paid_claims INT DEFAULT 0,
        previous_unpaid_claims INT DEFAULT 0,
        previous_denials INT DEFAULT 0,
        outstanding_amount NUMERIC(12, 2) DEFAULT 0.00,
        days_since_claim_submission INT DEFAULT 0,
        claim_type VARCHAR(50) DEFAULT 'Outpatient',
        final_payment_status VARCHAR(50) DEFAULT 'Unpaid',
        predicted_status VARCHAR(50),
        payment_probability NUMERIC(5, 4),
        risk_level VARCHAR(50),
        claim_status VARCHAR(50) DEFAULT 'Submitted',
        submission_date TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 10. Payments
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(64) PRIMARY KEY,
        encounter_id VARCHAR(64),
        claim_id VARCHAR(64),
        patient_id VARCHAR(64),
        source VARCHAR(50) DEFAULT 'Insurance',
        payment_type VARCHAR(100) NOT NULL,
        payer VARCHAR(255),
        amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        payment_date VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Completed',
        reference_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 11. Denials
    await client.query(`
      CREATE TABLE IF NOT EXISTS denials (
        id VARCHAR(64) PRIMARY KEY,
        claim_id VARCHAR(64) NOT NULL,
        patient_id VARCHAR(64),
        denial_code VARCHAR(50) NOT NULL,
        denial_reason TEXT NOT NULL,
        denial_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        denial_status VARCHAR(50) NOT NULL DEFAULT 'Active',
        appeal_status VARCHAR(50) NOT NULL DEFAULT 'Under Review',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 12. Prior Authorizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS prior_authorizations (
        id VARCHAR(64) PRIMARY KEY,
        authorization_request_id VARCHAR(64) UNIQUE NOT NULL,
        patient_id VARCHAR(64) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_id VARCHAR(64),
        service_name VARCHAR(255) NOT NULL,
        procedure_code VARCHAR(50) NOT NULL,
        diagnosis_code VARCHAR(50) NOT NULL,
        doctor_id VARCHAR(64),
        doctor_name VARCHAR(255),
        department_id VARCHAR(64),
        department_name VARCHAR(255),
        insurance_provider VARCHAR(255),
        member_id VARCHAR(100),
        policy_number VARCHAR(100),
        request_date VARCHAR(50) NOT NULL,
        service_date VARCHAR(50) NOT NULL,
        estimated_cost NUMERIC(12, 2),
        medical_justification TEXT,
        supporting_documents JSONB DEFAULT '[]'::jsonb,
        authorization_required BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'Pending',
        authorization_number VARCHAR(100),
        approved_date VARCHAR(50),
        valid_from VARCHAR(50),
        valid_until VARCHAR(50),
        denial_reason TEXT,
        suggested_action TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 13. Payment Predictions Store
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_predictions (
        id VARCHAR(64) PRIMARY KEY,
        claim_id VARCHAR(64),
        prediction VARCHAR(50) NOT NULL,
        probability NUMERIC(5, 4) NOT NULL,
        risk_level VARCHAR(50) NOT NULL,
        votes_paid INT NOT NULL DEFAULT 0,
        votes_unpaid INT NOT NULL DEFAULT 0,
        votes_total INT NOT NULL DEFAULT 0,
        top_factors JSONB DEFAULT '[]'::jsonb,
        input_features JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 14. Users (Authentication)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'User',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_insurance_patient ON insurance(patient_id);
      CREATE INDEX IF NOT EXISTS idx_charges_patient ON charges(patient_id);
      CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(claim_status);
      CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_denials_claim ON denials(claim_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Seed default departments if table is empty
    const deptCountRes = await client.query('SELECT COUNT(*) FROM departments');
    if (parseInt(deptCountRes.rows[0].count, 10) === 0) {
      const defaultDepts = [
        { id: 'dept-cardio', name: 'Cardiology', icon: 'heart', color: '#EF4444', description: 'Comprehensive heart, cardiovascular & hemodynamic diagnostics and care' },
        { id: 'dept-ortho', name: 'Orthopedics', icon: 'bone', color: '#06B6D4', description: 'Advanced musculoskeletal, joint, spine, and sports medicine rehabilitation' },
        { id: 'dept-derm', name: 'Dermatology', icon: 'sparkles', color: '#EC4899', description: 'Clinical & surgical dermatology, skin lesion biopsy, and phototherapy' },
        { id: 'dept-neuro', name: 'Neurology', icon: 'brain', color: '#8B5CF6', description: 'Central nervous system disorders, stroke management, and EEG diagnostics' },
        { id: 'dept-ped', name: 'Pediatrics', icon: 'baby', color: '#F59E0B', description: 'Comprehensive neonatal, child, and adolescent healthcare & immunizations' },
        { id: 'dept-gen', name: 'General Medicine', icon: 'stethoscope', color: '#10B981', description: 'Primary care, chronic disease management, and internal medicine' },
        { id: 'dept-onc', name: 'Oncology', icon: 'activity', color: '#D97706', description: 'Medical oncology, chemotherapy administration, and tumor surveillance' },
        { id: 'dept-ent', name: 'ENT & Otolaryngology', icon: 'mic', color: '#3B82F6', description: 'Ear, nose, throat diagnostics, audiology, and endoscopic sinus treatments' },
        { id: 'dept-pulmo', name: 'Pulmonology & Respiratory', icon: 'wind', color: '#0284C7', description: 'Comprehensive respiratory diagnostics, asthma, COPD & critical pulmonary care' },
        { id: 'dept-gastro', name: 'Gastroenterology & Hepatology', icon: 'shield', color: '#14B8A6', description: 'Advanced endoscopic procedures, liver disease, and digestive tract disorders' },
        { id: 'dept-nephro', name: 'Nephrology & Renal Care', icon: 'activity', color: '#6366F1', description: 'Kidney health, dialysis management, hypertension, and fluid balance therapies' },
        { id: 'dept-emergency', name: 'Emergency & Trauma Care', icon: 'alert-triangle', color: '#DC2626', description: '24/7 urgent resuscitation, acute trauma stabilization, and emergency triage' },
        { id: 'dept-ophthal', name: 'Ophthalmology & Eye Surgery', icon: 'eye', color: '#0D9488', description: 'Vision diagnostics, cataract surgery, retinal therapy, and pediatric optometry' },
        { id: 'dept-psych', name: 'Psychiatry & Behavioral Health', icon: 'smile', color: '#7C3AED', description: 'Mental health assessment, counseling, cognitive behavioral therapy, and psychotherapy' },
        { id: 'dept-uro', name: 'Urology & Urological Care', icon: 'stethoscope', color: '#2563EB', description: 'Urinary system treatment, minimally invasive urology, and kidney stone management' },
        { id: 'dept-radiology', name: 'Diagnostic Radiology & Imaging', icon: 'camera', color: '#475569', description: 'Advanced MRI, CT scanning, ultrasound, mammography, and interventional radiology' },
      ];
      for (const d of defaultDepts) {
        await client.query(
          'INSERT INTO departments (id, name, icon, color, description, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [d.id, d.name, d.icon, d.color, d.description, 'Active']
        );
      }
    }

    // Seed default admin user if users table is empty
    const userCountRes = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCountRes.rows[0].count, 10) === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      await client.query(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
        ['usr-admin-1', 'System Administrator', 'admin@medicare.com', adminHash, 'Admin']
      );
    }

    await client.query('COMMIT;');
    console.log('✅ [PostgreSQL] Initialized schema and all 14 tables in rcm_database');
    return true;
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ [PostgreSQL] Failed to initialize database schema:', err);
    return false;
  } finally {
    client.release();
  }
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'Admin' | 'User';
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRecord, 'password_hash'>;

export const db = {
  getStatus() {
    return {
      connected: true,
      database: process.env.PGDATABASE || 'rcm_database',
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
    };
  },
  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const res = await query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    return res.rows[0] || null;
  },
  async getUserById(id: string): Promise<UserRecord | null> {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  },
  async createUser(user: { name: string; email: string; password_hash: string; role: 'Admin' | 'User' }): Promise<SafeUser> {
    const id = `usr-${Math.random().toString(36).slice(2, 10)}`;
    const res = await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at, updated_at`,
      [id, user.name, user.email, user.password_hash, user.role || 'User']
    );
    return res.rows[0];
  },
  async getAllUsers(): Promise<SafeUser[]> {
    const res = await query('SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY created_at DESC');
    return res.rows;
  }
};
