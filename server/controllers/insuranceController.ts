import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapInsuranceRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id || undefined,
    insuranceProvider: row.insurance_provider,
    memberId: row.member_id,
    policyNumber: row.policy_number,
    policyHolderName: row.policy_holder_name || '',
    relationshipToPatient: row.relationship_to_patient || 'Self',
    groupNumber: row.group_number || '',
    effectiveDate: row.effective_date || '',
    expiryDate: row.expiry_date || '',
    insuranceStatus: row.insurance_status || 'Active',
    eligibilityStatus: row.eligibility_status || 'Eligible',
    coverageStatus: row.coverage_status || 'Active Coverage',
    copayAmount: Number(row.copay_amount || 0),
    deductible: Number(row.deductible || 0),
    coinsurance: Number(row.coinsurance || 0),
    coveredServices: Array.isArray(row.covered_services) ? row.covered_services : [],
    verificationResult: row.verification_result || undefined,
    providerStatus: row.provider_status || undefined,
    providerStatusCheckedAt: row.provider_status_checked_at || undefined,
    providerStatusReason: row.provider_status_reason || undefined,
    treatmentAmount: row.treatment_amount ? Number(row.treatment_amount) : undefined,
    requestedAmount: row.requested_amount ? Number(row.requested_amount) : undefined,
    patientResponsibilityAmount: row.patient_responsibility_amount ? Number(row.patient_responsibility_amount) : undefined,
    additionalCharges: row.additional_charges ? Number(row.additional_charges) : undefined,
    treatmentBreakdown: Array.isArray(row.treatment_breakdown) ? row.treatment_breakdown : [],
    billingBreakdown: Array.isArray(row.billing_breakdown) ? row.billing_breakdown : [],
    requestId: row.request_id || undefined,
    updatedAt: row.updated_at,
  };
}

export async function getAllInsurance(_req: Request, res: Response): Promise<void> {
  try {
    const result = await query('SELECT * FROM insurance ORDER BY created_at DESC');
    res.status(200).json({ success: true, data: result.rows.map(mapInsuranceRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch insurance list.' });
  }
}

export async function getInsuranceByPatientId(req: Request, res: Response): Promise<void> {
  try {
    const { patientId } = req.params;
    const result = await query('SELECT * FROM insurance WHERE patient_id = $1 OR id = $1', [patientId]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Insurance not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapInsuranceRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch insurance.' });
  }
}

export async function saveInsurance(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const id = body.id || `ins-${crypto.randomUUID().slice(0, 8)}`;
    const patientId = body.patientId;

    if (!patientId) {
      res.status(400).json({ success: false, message: 'patientId is required' });
      return;
    }

    // Check if exists for patient
    const existing = await query('SELECT id FROM insurance WHERE patient_id = $1', [patientId]);

    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE insurance SET
          insurance_provider = COALESCE($2, insurance_provider),
          member_id = COALESCE($3, member_id),
          policy_number = COALESCE($4, policy_number),
          policy_holder_name = COALESCE($5, policy_holder_name),
          relationship_to_patient = COALESCE($6, relationship_to_patient),
          group_number = COALESCE($7, group_number),
          effective_date = COALESCE($8, effective_date),
          expiry_date = COALESCE($9, expiry_date),
          insurance_status = COALESCE($10, insurance_status),
          eligibility_status = COALESCE($11, eligibility_status),
          coverage_status = COALESCE($12, coverage_status),
          copay_amount = COALESCE($13, copay_amount),
          deductible = COALESCE($14, deductible),
          coinsurance = COALESCE($15, coinsurance),
          covered_services = COALESCE($16, covered_services),
          verification_result = COALESCE($17, verification_result),
          provider_status = COALESCE($18, provider_status),
          treatment_amount = COALESCE($19, treatment_amount),
          requested_amount = COALESCE($20, requested_amount),
          patient_responsibility_amount = COALESCE($21, patient_responsibility_amount),
          additional_charges = COALESCE($22, additional_charges),
          treatment_breakdown = COALESCE($23, treatment_breakdown),
          billing_breakdown = COALESCE($24, billing_breakdown),
          request_id = COALESCE($25, request_id),
          updated_at = NOW()
        WHERE patient_id = $1
        RETURNING *`,
        [
          patientId,
          body.insuranceProvider,
          body.memberId,
          body.policyNumber,
          body.policyHolderName,
          body.relationshipToPatient,
          body.groupNumber,
          body.effectiveDate,
          body.expiryDate,
          body.insuranceStatus,
          body.eligibilityStatus,
          body.coverageStatus,
          body.copayAmount,
          body.deductible,
          body.coinsurance,
          body.coveredServices ? JSON.stringify(body.coveredServices) : null,
          body.verificationResult ? JSON.stringify(body.verificationResult) : null,
          body.providerStatus,
          body.treatmentAmount,
          body.requestedAmount,
          body.patientResponsibilityAmount,
          body.additionalCharges,
          body.treatmentBreakdown ? JSON.stringify(body.treatmentBreakdown) : null,
          body.billingBreakdown ? JSON.stringify(body.billingBreakdown) : null,
          body.requestId,
        ]
      );
    } else {
      result = await query(
        `INSERT INTO insurance (
          id, patient_id, appointment_id, insurance_provider, member_id, policy_number,
          policy_holder_name, relationship_to_patient, group_number, effective_date, expiry_date,
          insurance_status, eligibility_status, coverage_status, copay_amount, deductible, coinsurance,
          covered_services, verification_result, provider_status, treatment_amount, requested_amount,
          patient_responsibility_amount, additional_charges, treatment_breakdown, billing_breakdown, request_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        ) RETURNING *`,
        [
          id,
          patientId,
          body.appointmentId || null,
          body.insuranceProvider || '',
          body.memberId || '',
          body.policyNumber || '',
          body.policyHolderName || '',
          body.relationshipToPatient || 'Self',
          body.groupNumber || '',
          body.effectiveDate || '',
          body.expiryDate || '',
          body.insuranceStatus || 'Active',
          body.eligibilityStatus || 'Eligible',
          body.coverageStatus || 'Active Coverage',
          body.copayAmount || 0,
          body.deductible || 0,
          body.coinsurance || 0,
          JSON.stringify(body.coveredServices || []),
          body.verificationResult ? JSON.stringify(body.verificationResult) : null,
          body.providerStatus || null,
          body.treatmentAmount || null,
          body.requestedAmount || null,
          body.patientResponsibilityAmount || null,
          body.additionalCharges || null,
          JSON.stringify(body.treatmentBreakdown || []),
          JSON.stringify(body.billingBreakdown || []),
          body.requestId || null,
        ]
      );
    }

    res.status(200).json({ success: true, data: mapInsuranceRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to save insurance.' });
  }
}
