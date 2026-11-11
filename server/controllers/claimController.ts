import type { Request, Response } from 'express';
import { query } from '../db.ts';

function mapClaimRow(row: any) {
  if (!row) return null;
  return {
    claimId: row.claim_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientAge: row.patient_age,
    gender: row.gender,
    department: row.department,
    doctor: row.doctor,
    insuranceProvider: row.insurance_provider,
    claimAmount: Number(row.claim_amount || 0),
    procedureCode: row.procedure_code,
    procedureDescription: row.procedure_description,
    diagnosisCode: row.diagnosis_code,
    diagnosisDescription: row.diagnosis_description,
    numberOfProcedures: row.number_of_procedures,
    previousClaimsCount: row.previous_claims_count,
    previousPaidClaims: row.previous_paid_claims,
    previousUnpaidClaims: row.previous_unpaid_claims,
    previousDenials: row.previous_denials,
    outstandingAmount: Number(row.outstanding_amount || 0),
    daysSinceClaimSubmission: row.days_since_claim_submission,
    claimType: row.claim_type,
    finalPaymentStatus: row.final_payment_status,
    predictedStatus: row.predicted_status || undefined,
    paymentProbability: row.payment_probability ? Number(row.payment_probability) : undefined,
    riskLevel: row.risk_level || undefined,
    claimStatus: row.claim_status,
    submissionDate: row.submission_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllClaims(req: Request, res: Response): Promise<void> {
  try {
    const { searchQuery, status, riskLevel, limit = '100', page = '1' } = req.query;

    let conditions: string[] = [];
    let params: any[] = [];
    let idx = 1;

    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
      conditions.push(`(
        LOWER(claim_id) LIKE $${idx} OR
        LOWER(patient_name) LIKE $${idx} OR
        LOWER(doctor) LIKE $${idx} OR
        LOWER(insurance_provider) LIKE $${idx} OR
        LOWER(procedure_code) LIKE $${idx} OR
        LOWER(diagnosis_code) LIKE $${idx}
      )`);
      params.push(`%${searchQuery.trim().toLowerCase()}%`);
      idx++;
    }

    if (status && typeof status === 'string' && status.trim() && status !== 'All') {
      conditions.push(`claim_status = $${idx}`);
      params.push(status.trim());
      idx++;
    }

    if (riskLevel && typeof riskLevel === 'string' && riskLevel.trim() && riskLevel !== 'All') {
      conditions.push(`risk_level = $${idx}`);
      params.push(riskLevel.trim());
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const take = parseInt(limit as string, 10) || 100;
    const skip = (Math.max(1, parseInt(page as string, 10)) - 1) * take;

    const countSql = `SELECT COUNT(*) FROM claims ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const listSql = `SELECT * FROM claims ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(take, skip);

    const result = await query(listSql, params);
    const data = result.rows.map(mapClaimRow);

    res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page as string, 10) || 1,
      limit: take,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch claims.' });
  }
}

export async function getClaimById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM claims WHERE claim_id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Claim not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapClaimRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch claim.' });
  }
}

export async function createClaim(req: Request, res: Response): Promise<void> {
  try {
    const b = req.body;
    const claimId = b.claimId || `CLM-${Math.floor(100000 + Math.random() * 900000)}`;

    const result = await query(
      `INSERT INTO claims (
        claim_id, patient_id, patient_name, patient_age, gender, department, doctor,
        insurance_provider, claim_amount, procedure_code, procedure_description,
        diagnosis_code, diagnosis_description, number_of_procedures, previous_claims_count,
        previous_paid_claims, previous_unpaid_claims, previous_denials, outstanding_amount,
        days_since_claim_submission, claim_type, final_payment_status, predicted_status,
        payment_probability, risk_level, claim_status, submission_date, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW()
      ) ON CONFLICT (claim_id) DO UPDATE SET
        claim_amount = EXCLUDED.claim_amount,
        claim_status = EXCLUDED.claim_status,
        final_payment_status = EXCLUDED.final_payment_status,
        predicted_status = EXCLUDED.predicted_status,
        payment_probability = EXCLUDED.payment_probability,
        risk_level = EXCLUDED.risk_level,
        updated_at = NOW()
      RETURNING *`,
      [
        claimId,
        b.patientId || null,
        b.patientName || '',
        b.patientAge || 0,
        b.gender || 'Other',
        b.department || 'General Medicine',
        b.doctor || '',
        b.insuranceProvider || '',
        b.claimAmount || 0,
        b.procedureCode || '',
        b.procedureDescription || '',
        b.diagnosisCode || '',
        b.diagnosisDescription || '',
        b.numberOfProcedures || 1,
        b.previousClaimsCount || 0,
        b.previousPaidClaims || 0,
        b.previousUnpaidClaims || 0,
        b.previousDenials || 0,
        b.outstandingAmount || 0,
        b.daysSinceClaimSubmission || 0,
        b.claimType || 'Outpatient',
        b.finalPaymentStatus || 'Unpaid',
        b.predictedStatus || null,
        b.paymentProbability || null,
        b.riskLevel || null,
        b.claimStatus || 'Submitted',
        b.submissionDate ? new Date(b.submissionDate) : new Date(),
      ]
    );

    res.status(201).json({ success: true, data: mapClaimRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create claim.' });
  }
}
