import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import crypto from 'node:crypto';
import { query } from '../db.ts';

// ============================================================================
// 1. DATA RETRIEVAL TOOLS
// ============================================================================

export const getPatientsTool = new DynamicStructuredTool({
  name: 'get_patients',
  description: 'Retrieve registered patients with optional search term, limit, or ID filter.',
  schema: z.object({
    search: z.string().optional().describe('Search by name, phone, email, or patient code'),
    limit: z.number().optional().default(50).describe('Max results to return'),
    patientId: z.string().optional().describe('Filter by specific patient ID or code')
  }),
  func: async ({ search, limit = 50, patientId }) => {
    let sql = 'SELECT id, patient_id, first_name, last_name, dob, gender, phone, email, address, blood_group, created_at FROM patients';
    const params: any[] = [];
    const conditions: string[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`(id = $${params.length} OR patient_id = $${params.length})`);
    } else if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(first_name) LIKE $${params.length} OR LOWER(last_name) LIKE $${params.length} OR LOWER(patient_id) LIKE $${params.length} OR LOWER(phone) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, data: result.rows });
  }
});

export const getPatientTool = new DynamicStructuredTool({
  name: 'get_patient',
  description: 'Get full profile, demographic details and contact info of a single patient by ID or code.',
  schema: z.object({
    patientId: z.string().describe('Patient UUID or code (e.g. PAT-1001 or pat-001)')
  }),
  func: async ({ patientId }) => {
    const result = await query(
      'SELECT * FROM patients WHERE id = $1 OR LOWER(patient_id) = LOWER($1)',
      [patientId]
    );
    if (result.rows.length === 0) {
      return JSON.stringify({ error: `Patient '${patientId}' not found.` });
    }
    return JSON.stringify({ patient: result.rows[0] });
  }
});

export const getDoctorsTool = new DynamicStructuredTool({
  name: 'get_doctors',
  description: 'List physicians, specialties, department assignments, and working hours.',
  schema: z.object({
    departmentName: z.string().optional().describe('Filter by department name, e.g. Cardiology'),
    search: z.string().optional().describe('Doctor name or specialty search')
  }),
  func: async ({ departmentName, search }) => {
    let sql = 'SELECT id, name, department_name, specialization, room_number, experience FROM doctors';
    const params: any[] = [];
    const conditions: string[] = [];

    if (departmentName) {
      params.push(`%${departmentName.toLowerCase()}%`);
      conditions.push(`LOWER(department_name) LIKE $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(specialization) LIKE $${params.length})`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY name ASC';

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, doctors: result.rows });
  }
});

export const getDepartmentsTool = new DynamicStructuredTool({
  name: 'get_departments',
  description: 'Retrieve hospital clinical departments and their active status.',
  schema: z.object({}),
  func: async () => {
    const result = await query('SELECT * FROM departments ORDER BY name ASC');
    return JSON.stringify({ count: result.rows.length, departments: result.rows });
  }
});

export const getAppointmentsTool = new DynamicStructuredTool({
  name: 'get_appointments',
  description: 'Search appointments by date (e.g. today or YYYY-MM-DD), status (Confirmed, Completed, Cancelled), patient, or doctor.',
  schema: z.object({
    date: z.string().optional().describe('Date in YYYY-MM-DD format or "today"'),
    status: z.string().optional().describe('Appointment status filter: Confirmed, Completed, Cancelled, Rescheduled'),
    patientId: z.string().optional().describe('Patient ID filter'),
    doctorId: z.string().optional().describe('Doctor ID filter'),
    limit: z.number().optional().default(50)
  }),
  func: async ({ date, status, patientId, doctorId, limit = 50 }) => {
    let sql = `
      SELECT 
        a.id, a.appointment_code, a.appointment_date, a.appointment_time,
        a.duration_minutes, a.appointment_type, a.status, a.reason_for_visit, a.notes,
        p.id as patient_id, p.patient_id as patient_code, p.first_name, p.last_name, p.phone as patient_phone,
        d.id as doctor_id, d.name as doctor_name, a.department_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (date) {
      const targetDate = date.toLowerCase() === 'today' ? new Date().toISOString().split('T')[0] : date;
      params.push(targetDate);
      conditions.push(`a.appointment_date = $${params.length}`);
    }
    if (status && status !== 'All') {
      params.push(status);
      conditions.push(`LOWER(a.status) = LOWER($${params.length})`);
    }
    if (patientId) {
      params.push(patientId);
      conditions.push(`(a.patient_id = $${params.length} OR p.patient_id = $${params.length})`);
    }
    if (doctorId) {
      params.push(doctorId);
      conditions.push(`a.doctor_id = $${params.length}`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, appointments: result.rows });
  }
});

export const getInsuranceTool = new DynamicStructuredTool({
  name: 'get_insurance',
  description: 'Retrieve patient insurance coverage details, policy numbers, eligibility status, copay, and deductibles.',
  schema: z.object({
    patientId: z.string().optional().describe('Filter by patient ID or code'),
    providerName: z.string().optional().describe('Filter by payer / provider name')
  }),
  func: async ({ patientId, providerName }) => {
    let sql = `
      SELECT i.*, p.first_name, p.last_name, p.patient_id as patient_code
      FROM insurance i
      LEFT JOIN patients p ON i.patient_id = p.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`(i.patient_id = $${params.length} OR p.patient_id = $${params.length})`);
    }
    if (providerName) {
      params.push(`%${providerName.toLowerCase()}%`);
      conditions.push(`LOWER(i.insurance_provider) LIKE $${params.length}`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY i.created_at DESC LIMIT 50';

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, records: result.rows });
  }
});

export const getPriorAuthorizationsTool = new DynamicStructuredTool({
  name: 'get_prior_authorizations',
  description: 'Query prior authorization requests, approval status, service dates, procedure codes, and justification.',
  schema: z.object({
    patientId: z.string().optional().describe('Patient ID or code'),
    status: z.string().optional().describe('Approval status: Pending, Approved, Denied')
  }),
  func: async ({ patientId, status }) => {
    let sql = `
      SELECT pa.*, p.first_name, p.last_name, p.patient_id as patient_code
      FROM prior_authorizations pa
      LEFT JOIN patients p ON pa.patient_id = p.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`(pa.patient_id = $${params.length} OR p.patient_id = $${params.length})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`LOWER(pa.status) = LOWER($${params.length})`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY pa.request_date DESC LIMIT 50';

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, priorAuthorizations: result.rows });
  }
});

export const getChargesTool = new DynamicStructuredTool({
  name: 'get_charges',
  description: 'Query charge capture encounters, fee items, insurance expected vs patient responsibility amounts.',
  schema: z.object({
    patientId: z.string().optional().describe('Patient ID filter'),
    claimStatus: z.string().optional().describe('Charge claim status (Draft, Coded, Billed)')
  }),
  func: async ({ patientId, claimStatus }) => {
    let sql = `
      SELECT c.*, p.first_name, p.last_name, p.patient_id as patient_code
      FROM charges c
      LEFT JOIN patients p ON c.patient_id = p.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`(c.patient_id = $${params.length} OR p.patient_id = $${params.length})`);
    }
    if (claimStatus) {
      params.push(claimStatus);
      conditions.push(`LOWER(c.claim_status) = LOWER($${params.length})`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY c.created_at DESC LIMIT 50';

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, charges: result.rows });
  }
});

export const getMedicalCodingTool = new DynamicStructuredTool({
  name: 'get_medical_coding',
  description: 'Retrieve clinical coding records, ICD-10 diagnosis codes, CPT procedure codes, and coding statuses.',
  schema: z.object({
    patientId: z.string().optional().describe('Patient ID filter'),
    status: z.string().optional().describe('Coding status filter')
  }),
  func: async ({ patientId, status }) => {
    let sql = `
      SELECT mc.*, p.first_name, p.last_name, p.patient_id as patient_code
      FROM medical_coding mc
      LEFT JOIN patients p ON mc.patient_id = p.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`(mc.patient_id = $${params.length} OR p.patient_id = $${params.length})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`LOWER(mc.coding_status) = LOWER($${params.length})`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY mc.created_at DESC LIMIT 50';

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, medicalCoding: result.rows });
  }
});

export const getClaimsTool = new DynamicStructuredTool({
  name: 'get_claims',
  description: 'Retrieve healthcare claims with filters for status (Pending, Submitted, Paid, Denied), minimum amount, insurance provider, or patient.',
  schema: z.object({
    status: z.string().optional().describe('Claim status filter, e.g. Submitted, Pending, In Review, Paid, Denied'),
    minAmount: z.number().optional().describe('Filter claims with amount greater than or equal to this threshold'),
    insuranceProvider: z.string().optional().describe('Insurance provider name filter'),
    patientName: z.string().optional().describe('Patient name filter'),
    unpaidOnly: z.boolean().optional().describe('Show only unpaid claims or claims with outstanding balance'),
    limit: z.number().optional().default(50)
  }),
  func: async ({ status, minAmount, insuranceProvider, patientName, unpaidOnly, limit = 50 }) => {
    let sql = 'SELECT * FROM claims';
    const params: any[] = [];
    const conditions: string[] = [];

    if (status && status !== 'All') {
      params.push(status);
      conditions.push(`LOWER(claim_status) = LOWER($${params.length})`);
    }
    if (minAmount !== undefined && minAmount > 0) {
      params.push(minAmount);
      conditions.push(`claim_amount >= $${params.length}`);
    }
    if (insuranceProvider) {
      params.push(`%${insuranceProvider.toLowerCase()}%`);
      conditions.push(`LOWER(insurance_provider) LIKE $${params.length}`);
    }
    if (patientName) {
      params.push(`%${patientName.toLowerCase()}%`);
      conditions.push(`LOWER(patient_name) LIKE $${params.length}`);
    }
    if (unpaidOnly) {
      conditions.push(`(LOWER(final_payment_status) = 'unpaid' OR outstanding_amount > 0)`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY claim_amount DESC, submission_date DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, claims: result.rows });
  }
});

export const getClaimAdjudicationTool = new DynamicStructuredTool({
  name: 'get_claim_adjudication',
  description: 'Inspect claim adjudication records, approved vs allowed amounts, patient co-pay/deductible portions, and denial explanations.',
  schema: z.object({
    claimId: z.string().optional().describe('Claim ID filter')
  }),
  func: async ({ claimId }) => {
    let sql = 'SELECT * FROM claims';
    const params: any[] = [];
    if (claimId) {
      params.push(claimId);
      sql += ' WHERE claim_id = $1';
    }
    sql += ' ORDER BY updated_at DESC LIMIT 50';
    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, adjudications: result.rows });
  }
});

export const getPaymentsTool = new DynamicStructuredTool({
  name: 'get_payments',
  description: 'Retrieve payment transactions, remittances, payers, payment types, and total revenue.',
  schema: z.object({
    patientId: z.string().optional().describe('Patient ID'),
    payer: z.string().optional().describe('Payer or insurance company name'),
    paymentType: z.string().optional().describe('Payment type: Electronic, Check, Card'),
    thisMonthOnly: z.boolean().optional().describe('Filter payments made in current month')
  }),
  func: async ({ patientId, payer, paymentType, thisMonthOnly }) => {
    let sql = 'SELECT * FROM payments';
    const params: any[] = [];
    const conditions: string[] = [];

    if (patientId) {
      params.push(patientId);
      conditions.push(`patient_id = $${params.length}`);
    }
    if (payer) {
      params.push(`%${payer.toLowerCase()}%`);
      conditions.push(`LOWER(payer) LIKE $${params.length}`);
    }
    if (paymentType) {
      params.push(paymentType);
      conditions.push(`LOWER(payment_type) = LOWER($${params.length})`);
    }
    if (thisMonthOnly) {
      conditions.push(`payment_date >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM-DD')`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY payment_date DESC, created_at DESC LIMIT 50';

    const result = await query(sql, params);
    const sumResult = await query(
      `SELECT SUM(amount) as total_amount FROM payments ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}`,
      params
    );

    return JSON.stringify({
      count: result.rows.length,
      totalAmount: Number(sumResult.rows[0]?.total_amount || 0),
      payments: result.rows
    });
  }
});

export const getDenialsTool = new DynamicStructuredTool({
  name: 'get_denials',
  description: 'Query claim denials, denial codes (CO-16, PR-1, CO-97), reasons, denial amounts, and appeal statuses.',
  schema: z.object({
    claimId: z.string().optional().describe('Specific claim ID'),
    denialCode: z.string().optional().describe('Denial code, e.g. CO-16'),
    appealStatus: z.string().optional().describe('Appeal status filter')
  }),
  func: async ({ claimId, denialCode, appealStatus }) => {
    let sql = `
      SELECT d.*, c.patient_name, c.insurance_provider, c.claim_amount
      FROM denials d
      LEFT JOIN claims c ON d.claim_id = c.claim_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (claimId) {
      params.push(claimId);
      conditions.push(`d.claim_id = $${params.length}`);
    }
    if (denialCode) {
      params.push(denialCode);
      conditions.push(`LOWER(d.denial_code) = LOWER($${params.length})`);
    }
    if (appealStatus) {
      params.push(appealStatus);
      conditions.push(`LOWER(d.appeal_status) = LOWER($${params.length})`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY d.created_at DESC LIMIT 50';

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, denials: result.rows });
  }
});

export const getBillingTool = new DynamicStructuredTool({
  name: 'get_billing',
  description: 'Financial billing summary: total billed charges, insurance payments, patient balances, and outstanding amounts.',
  schema: z.object({}),
  func: async () => {
    const summary = await query(`
      SELECT 
        SUM(total_charges) as total_charges,
        SUM(insurance_received) as insurance_received,
        SUM(insurance_pending) as insurance_pending,
        SUM(patient_responsibility) as patient_responsibility,
        SUM(patient_paid) as patient_paid,
        SUM(patient_pending) as patient_pending,
        SUM(total_outstanding_ar) as total_outstanding_ar
      FROM charges
    `);
    return JSON.stringify({ summary: summary.rows[0] });
  }
});

export const getAccountsReceivableTool = new DynamicStructuredTool({
  name: 'get_accounts_receivable',
  description: 'Query Accounts Receivable (A/R) metrics, outstanding balances, and aging claims.',
  schema: z.object({
    minBalance: z.number().optional().default(0).describe('Minimum outstanding balance')
  }),
  func: async ({ minBalance = 0 }) => {
    const result = await query(`
      SELECT 
        p.id as patient_id,
        p.patient_id as patient_code,
        p.first_name,
        p.last_name,
        p.phone,
        COALESCE(SUM(c.total_outstanding_ar), 0) as outstanding_balance,
        COUNT(c.id) as encounter_count
      FROM patients p
      JOIN charges c ON p.id = c.patient_id
      GROUP BY p.id, p.patient_id, p.first_name, p.last_name, p.phone
      HAVING COALESCE(SUM(c.total_outstanding_ar), 0) >= $1
      ORDER BY outstanding_balance DESC
      LIMIT 50
    `, [minBalance]);
    return JSON.stringify({ count: result.rows.length, patientsWithBalance: result.rows });
  }
});

export const getCollectionsTool = new DynamicStructuredTool({
  name: 'get_collections',
  description: 'Query overdue balances and collection risks across accounts.',
  schema: z.object({}),
  func: async () => {
    const result = await query(`
      SELECT 
        claim_id, patient_name, insurance_provider, claim_amount,
        outstanding_amount, days_since_claim_submission, risk_level, final_payment_status
      FROM claims
      WHERE outstanding_amount > 0 AND days_since_claim_submission > 30
      ORDER BY days_since_claim_submission DESC, outstanding_amount DESC
      LIMIT 50
    `);
    return JSON.stringify({ count: result.rows.length, collectionRiskClaims: result.rows });
  }
});

export const getPaymentPredictionsTool = new DynamicStructuredTool({
  name: 'get_payment_predictions',
  description: 'Query AI payment predictions, risk levels (High, Medium, Low), predicted paid vs unpaid probability.',
  schema: z.object({
    riskLevel: z.string().optional().describe('High, Medium, or Low'),
    prediction: z.string().optional().describe('Paid or Unpaid')
  }),
  func: async ({ riskLevel, prediction }) => {
    let sql = `
      SELECT pp.*, c.patient_name, c.claim_amount, c.insurance_provider, c.procedure_code
      FROM payment_predictions pp
      LEFT JOIN claims c ON pp.claim_id = c.claim_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (riskLevel) {
      params.push(riskLevel);
      conditions.push(`LOWER(pp.risk_level) = LOWER($${params.length})`);
    }
    if (prediction) {
      params.push(prediction);
      conditions.push(`LOWER(pp.prediction) = LOWER($${params.length})`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY pp.probability DESC LIMIT 50';

    const result = await query(sql, params);
    return JSON.stringify({ count: result.rows.length, predictions: result.rows });
  }
});

// ============================================================================
// 2. WRITE / MUTATION ACTION TOOLS (CONTROLLED & SAFE)
// ============================================================================

function formatPatientRecord(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    patient_id: row.patient_id,
    patientId: row.patient_id,
    first_name: row.first_name,
    firstName: row.first_name,
    last_name: row.last_name,
    lastName: row.last_name,
    name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    dob: row.dob,
    date_of_birth: row.dob,
    gender: row.gender,
    phone: row.phone,
    email: row.email || '',
    address: row.address || '',
    avatar: row.avatar || '',
    blood_group: row.blood_group || '',
    bloodGroup: row.blood_group || '',
    emergency_contact: row.emergency_contact || '',
    emergencyContact: row.emergency_contact || '',
    created_at: row.created_at,
    createdAt: row.created_at,
  };
}

function formatAppointmentRecord(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    appointment_id: row.id,
    appointmentCode: row.appointment_code,
    appointment_code: row.appointment_code,
    patientId: row.patient_id,
    patient_id: row.patient_id,
    patient: {
      id: row.p_id || row.patient_id,
      patientCode: row.patient_code || row.patient_id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Patient',
      phone: row.phone || '',
      avatar: row.avatar || '',
      gender: row.gender || 'Other',
      dob: row.dob || '',
      email: row.email || '',
      address: row.address || '',
    },
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    doctorId: row.doctor_id,
    doctor_id: row.doctor_id,
    doctorName: row.doctor_name || 'Assigned Physician',
    doctor_name: row.doctor_name || 'Assigned Physician',
    doctor: {
      id: row.doctor_id,
      name: row.doctor_name || 'Assigned Physician',
      avatar: '',
      department: row.department_name || '',
    },
    departmentId: row.department_id || '',
    department_id: row.department_id || '',
    departmentName: row.department_name || '',
    department_name: row.department_name || '',
    appointmentDate: row.appointment_date,
    appointment_date: row.appointment_date,
    appointmentTime: row.appointment_time,
    appointment_time: row.appointment_time,
    durationMinutes: row.duration_minutes || 30,
    duration_minutes: row.duration_minutes || 30,
    appointmentType: row.appointment_type || 'Consultation',
    appointment_type: row.appointment_type || 'Consultation',
    status: row.status || 'Confirmed',
    reasonForVisit: row.reason_for_visit || '',
    reason_for_visit: row.reason_for_visit || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

export async function executeCreatePatient(payload: {
  id?: string;
  patientId?: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContact?: string;
}) {
  const cleanFirst = (payload.firstName || '').trim();
  const cleanLast = (payload.lastName || '').trim();
  const cleanPhone = (payload.phone || '').trim();
  const cleanEmail = (payload.email || '').trim().toLowerCase();

  // 1. Check if patient already exists (Requirement 10: prevent duplicate records on retry)
  let existingQuery = `
    SELECT * FROM patients
    WHERE (LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2) AND phone = $3)
       OR (phone = $3 AND phone != '' AND phone IS NOT NULL)
  `;
  const existingParams: any[] = [cleanFirst, cleanLast, cleanPhone];
  if (cleanEmail) {
    existingParams.push(cleanEmail);
    existingQuery += ` OR (email != '' AND LOWER(email) = LOWER($${existingParams.length}))`;
  }
  existingQuery += ` ORDER BY created_at DESC LIMIT 1`;

  const existingRes = await query(existingQuery, existingParams);
  if (existingRes.rows.length > 0) {
    console.log(`[Assistant] Patient already exists: ${existingRes.rows[0].patient_id}. Reusing existing record.`);
    return formatPatientRecord(existingRes.rows[0]);
  }

  // 2. Sequential Patient ID generation matching patientController.ts
  let patientCode = payload.patientId;
  if (!patientCode) {
    try {
      const maxRes = await query(`
        SELECT patient_id FROM patients 
        WHERE patient_id ~ '^PAT-[0-9]+$' 
        ORDER BY CAST(SUBSTRING(patient_id FROM 5) AS INTEGER) DESC 
        LIMIT 1
      `);
      if (maxRes.rows.length > 0 && maxRes.rows[0]?.patient_id) {
        const lastNum = parseInt(maxRes.rows[0].patient_id.replace('PAT-', ''), 10);
        patientCode = `PAT-${lastNum + 1}`;
      } else {
        patientCode = `PAT-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    } catch {
      patientCode = `PAT-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  const id = payload.id || `pat-${crypto.randomUUID().slice(0, 8)}`;

  // 3. Insert into PostgreSQL
  const result = await query(
    `INSERT INTO patients (
      id, patient_id, first_name, last_name, dob, gender, phone, email, address, blood_group, emergency_contact
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      id,
      patientCode,
      cleanFirst,
      cleanLast,
      payload.dob || '',
      payload.gender || 'Other',
      cleanPhone,
      cleanEmail,
      payload.address || '',
      payload.bloodGroup || '',
      payload.emergencyContact || ''
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Database failed to insert patient record.');
  }

  // 4. Verify patient persistence directly in PostgreSQL (Requirement 2 & 4)
  const verifyRes = await query(`SELECT * FROM patients WHERE id = $1`, [id]);
  if (verifyRes.rows.length === 0) {
    throw new Error('Verification failed: Patient was not persisted in PostgreSQL patients table.');
  }

  return formatPatientRecord(verifyRes.rows[0]);
}

export async function executeCreateAppointment(payload: {
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  departmentId?: string;
  departmentName?: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes?: number;
  appointmentType?: string;
  reasonForVisit?: string;
  notes?: string;
}) {
  // 1. Resolve patient in PostgreSQL (support either internal id or patient_id code)
  let patientDbId = payload.patientId;
  const pCheck = await query(
    `SELECT id, patient_id, first_name, last_name, phone FROM patients WHERE id = $1 OR LOWER(patient_id) = LOWER($1) LIMIT 1`,
    [payload.patientId]
  );
  if (pCheck.rows.length > 0) {
    patientDbId = pCheck.rows[0].id;
  } else {
    throw new Error(`Patient '${payload.patientId}' does not exist in PostgreSQL database.`);
  }

  // 2. Resolve doctor in PostgreSQL
  let doctorDbId = payload.doctorId;
  let deptId = payload.departmentId || null;
  let deptName = payload.departmentName || '';

  const cleanDocTerm = (payload.doctorName || payload.doctorId || '').replace(/dr\.?\s*/i, '').trim().toLowerCase();
  const dCheck = await query(
    `SELECT id, name, department_id, department_name FROM doctors WHERE id = $1 OR LOWER(name) = LOWER($1) OR LOWER(name) LIKE $2 LIMIT 1`,
    [payload.doctorId, `%${cleanDocTerm}%`]
  );
  if (dCheck.rows.length > 0) {
    doctorDbId = dCheck.rows[0].id;
    deptId = dCheck.rows[0].department_id || deptId;
    deptName = dCheck.rows[0].department_name || deptName;
  }

  // 3. Generate sequential appointment code
  const id = `apt-${crypto.randomUUID().slice(0, 8)}`;
  let appointmentCode = `APT${Math.floor(10000 + Math.random() * 90000)}`;
  try {
    const maxApt = await query(`
      SELECT appointment_code FROM appointments 
      WHERE appointment_code ~ '^APT[0-9]+$' 
      ORDER BY CAST(SUBSTRING(appointment_code FROM 4) AS INTEGER) DESC 
      LIMIT 1
    `);
    if (maxApt.rows.length > 0 && maxApt.rows[0]?.appointment_code) {
      const lastNum = parseInt(maxApt.rows[0].appointment_code.replace('APT', ''), 10);
      appointmentCode = `APT${lastNum + 1}`;
    }
  } catch {}

  // 4. Insert into PostgreSQL appointments table
  const insertRes = await query(
    `INSERT INTO appointments (
      id, appointment_code, patient_id, doctor_id, department_id, department_name,
      appointment_date, appointment_time, duration_minutes, appointment_type, status,
      reason_for_visit, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      id,
      appointmentCode,
      patientDbId,
      doctorDbId,
      deptId,
      deptName,
      payload.appointmentDate,
      payload.appointmentTime,
      payload.durationMinutes || 30,
      payload.appointmentType || 'Consultation',
      'Confirmed',
      payload.reasonForVisit || 'Scheduled via RCM AI Assistant',
      payload.notes || ''
    ]
  );

  if (insertRes.rows.length === 0) {
    throw new Error('Database failed to insert appointment record.');
  }

  // 5. Verify appointment persistence directly in PostgreSQL
  const fullResult = await query(
    `SELECT a.*, p.id as p_id, p.first_name, p.last_name, p.patient_id as patient_code, p.phone, p.email, p.dob, p.gender, p.address, p.avatar, d.name as doctor_name
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     WHERE a.id = $1`,
    [id]
  );

  if (fullResult.rows.length === 0) {
    throw new Error('Verification failed: Appointment was not persisted in PostgreSQL appointments table.');
  }

  return formatAppointmentRecord(fullResult.rows[0]);
}

export async function executeUpdateAppointment(id: string, updates: Record<string, any>) {
  const fields: string[] = [];
  const params: any[] = [id];
  let idx = 2;

  if (updates.status) {
    fields.push(`status = $${idx++}`);
    params.push(updates.status);
  }
  if (updates.appointmentDate) {
    fields.push(`appointment_date = $${idx++}`);
    params.push(updates.appointmentDate);
  }
  if (updates.appointmentTime) {
    fields.push(`appointment_time = $${idx++}`);
    params.push(updates.appointmentTime);
  }
  if (updates.reasonForVisit) {
    fields.push(`reason_for_visit = $${idx++}`);
    params.push(updates.reasonForVisit);
  }

  fields.push(`updated_at = NOW()`);

  const sql = `UPDATE appointments SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await query(sql, params);
  return result.rows[0];
}

export async function executeCreateClaim(payload: {
  patientId: string;
  patientName: string;
  insuranceProvider: string;
  claimAmount: number;
  procedureCode?: string;
  procedureDescription?: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
  doctor?: string;
  department?: string;
}) {
  const claimId = `CLM-${Math.floor(100000 + Math.random() * 900000)}`;

  const result = await query(
    `INSERT INTO claims (
      claim_id, patient_id, patient_name, doctor, department, insurance_provider,
      claim_amount, procedure_code, procedure_description, diagnosis_code, diagnosis_description,
      claim_status, final_payment_status, outstanding_amount, submission_date, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    RETURNING *`,
    [
      claimId,
      payload.patientId,
      payload.patientName,
      payload.doctor || 'Dr. Assigned',
      payload.department || 'General Medicine',
      payload.insuranceProvider,
      payload.claimAmount,
      payload.procedureCode || '99213',
      payload.procedureDescription || 'Office Visit',
      payload.diagnosisCode || 'Z00.00',
      payload.diagnosisDescription || 'General Medical Exam',
      'Submitted',
      'Unpaid',
      payload.claimAmount
    ]
  );
  return result.rows[0];
}

export async function executeUpdateClaimStatus(claimId: string, status: string) {
  const result = await query(
    `UPDATE claims SET claim_status = $2, updated_at = NOW() WHERE claim_id = $1 RETURNING *`,
    [claimId, status]
  );
  return result.rows[0];
}

export async function executeRecordPayment(payload: {
  patientId?: string;
  claimId?: string;
  amount: number;
  payer: string;
  paymentType: string;
  notes?: string;
}) {
  const id = `pay-${crypto.randomUUID().slice(0, 8)}`;
  const ref = `REF-${Math.floor(10000 + Math.random() * 90000)}`;
  const dateStr = new Date().toISOString().split('T')[0];

  const result = await query(
    `INSERT INTO payments (
      id, claim_id, patient_id, source, payment_type, payer,
      amount, payment_date, status, reference_number, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      id,
      payload.claimId || null,
      payload.patientId || null,
      'Insurance',
      payload.paymentType || 'Electronic Remittance',
      payload.payer,
      payload.amount,
      dateStr,
      'Completed',
      ref,
      payload.notes || 'Recorded via RCM AI Assistant'
    ]
  );

  // If claimId provided, update outstanding amount
  if (payload.claimId) {
    await query(
      `UPDATE claims 
       SET outstanding_amount = GREATEST(0, outstanding_amount - $2),
           final_payment_status = CASE WHEN outstanding_amount - $2 <= 0 THEN 'Paid' ELSE final_payment_status END,
           updated_at = NOW()
       WHERE claim_id = $1`,
      [payload.claimId, payload.amount]
    );
  }

  return result.rows[0];
}

export const allRcmTools = [
  getPatientsTool,
  getPatientTool,
  getDoctorsTool,
  getDepartmentsTool,
  getAppointmentsTool,
  getInsuranceTool,
  getPriorAuthorizationsTool,
  getChargesTool,
  getMedicalCodingTool,
  getClaimsTool,
  getClaimAdjudicationTool,
  getPaymentsTool,
  getDenialsTool,
  getBillingTool,
  getAccountsReceivableTool,
  getCollectionsTool,
  getPaymentPredictionsTool
];
