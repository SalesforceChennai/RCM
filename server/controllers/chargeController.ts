import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapChargeRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id || undefined,
    encounterDate: row.encounter_date,
    visitType: row.visit_type || 'Outpatient Consultation',
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    insuranceProvider: row.insurance_provider,
    memberId: row.member_id,
    policyNumber: row.policy_number,
    insuranceVerificationStatus: row.insurance_verification_status || 'Verified',
    claimStatus: row.claim_status || 'Draft',
    items: Array.isArray(row.items) ? row.items : [],
    payments: Array.isArray(row.payments) ? row.payments : [],
    totalCharges: Number(row.total_charges || 0),
    expectedInsuranceCoverage: Number(row.expected_insurance_coverage || 0),
    insuranceReceived: Number(row.insurance_received || 0),
    insurancePending: Number(row.insurance_pending || 0),
    patientResponsibility: Number(row.patient_responsibility || 0),
    patientPaid: Number(row.patient_paid || 0),
    patientPending: Number(row.patient_pending || 0),
    totalOutstandingAR: Number(row.total_outstanding_ar || 0),
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllCharges(req: Request, res: Response): Promise<void> {
  try {
    const { patientId } = req.query;
    let sql = 'SELECT * FROM charges ORDER BY created_at DESC';
    let params: any[] = [];

    if (patientId && typeof patientId === 'string' && patientId.trim()) {
      sql = 'SELECT * FROM charges WHERE patient_id = $1 ORDER BY created_at DESC';
      params = [patientId.trim()];
    }

    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows.map(mapChargeRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch charges.' });
  }
}

export async function getChargeById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM charges WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Charge encounter not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapChargeRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch charge.' });
  }
}

export async function saveCharge(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const id = body.id || `enc-${crypto.randomUUID().slice(0, 8)}`;

    const result = await query(
      `INSERT INTO charges (
        id, patient_id, appointment_id, encounter_date, visit_type,
        doctor_id, doctor_name, department_id, department_name,
        insurance_provider, member_id, policy_number, insurance_verification_status,
        claim_status, items, payments, total_charges, expected_insurance_coverage,
        insurance_received, insurance_pending, patient_responsibility, patient_paid,
        patient_pending, total_outstanding_ar, notes, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        appointment_id = EXCLUDED.appointment_id,
        encounter_date = EXCLUDED.encounter_date,
        visit_type = EXCLUDED.visit_type,
        doctor_id = EXCLUDED.doctor_id,
        doctor_name = EXCLUDED.doctor_name,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        insurance_provider = EXCLUDED.insurance_provider,
        member_id = EXCLUDED.member_id,
        policy_number = EXCLUDED.policy_number,
        insurance_verification_status = EXCLUDED.insurance_verification_status,
        claim_status = EXCLUDED.claim_status,
        items = EXCLUDED.items,
        payments = EXCLUDED.payments,
        total_charges = EXCLUDED.total_charges,
        expected_insurance_coverage = EXCLUDED.expected_insurance_coverage,
        insurance_received = EXCLUDED.insurance_received,
        insurance_pending = EXCLUDED.insurance_pending,
        patient_responsibility = EXCLUDED.patient_responsibility,
        patient_paid = EXCLUDED.patient_paid,
        patient_pending = EXCLUDED.patient_pending,
        total_outstanding_ar = EXCLUDED.total_outstanding_ar,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        body.patientId,
        body.appointmentId || null,
        body.encounterDate || new Date().toISOString().split('T')[0],
        body.visitType || 'Outpatient Consultation',
        body.doctorId || '',
        body.doctorName || '',
        body.departmentId || '',
        body.departmentName || '',
        body.insuranceProvider || '',
        body.memberId || '',
        body.policyNumber || '',
        body.insuranceVerificationStatus || 'Verified',
        body.claimStatus || 'Draft',
        JSON.stringify(body.items || []),
        JSON.stringify(body.payments || []),
        body.totalCharges || 0,
        body.expectedInsuranceCoverage || 0,
        body.insuranceReceived || 0,
        body.insurancePending || 0,
        body.patientResponsibility || 0,
        body.patientPaid || 0,
        body.patientPending || 0,
        body.totalOutstandingAR || 0,
        body.notes || '',
      ]
    );

    res.status(200).json({ success: true, data: mapChargeRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to save charge.' });
  }
}
