import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapPriorAuthRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    authorizationRequestId: row.authorization_request_id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id || undefined,
    serviceName: row.service_name,
    procedureCode: row.procedure_code,
    diagnosisCode: row.diagnosis_code,
    doctorId: row.doctor_id || '',
    doctorName: row.doctor_name || '',
    departmentId: row.department_id || '',
    departmentName: row.department_name || '',
    insuranceProvider: row.insurance_provider || '',
    memberId: row.member_id || '',
    policyNumber: row.policy_number || '',
    requestDate: row.request_date,
    serviceDate: row.service_date,
    estimatedCost: row.estimated_cost !== null && row.estimated_cost !== undefined ? Number(row.estimated_cost) : 0,
    medicalJustification: row.medical_justification || '',
    supportingDocuments: Array.isArray(row.supporting_documents) ? row.supporting_documents : [],
    authorizationRequired: row.authorization_required !== false,
    status: row.status || 'Pending',
    authorizationNumber: row.authorization_number || undefined,
    approvedDate: row.approved_date || undefined,
    validFrom: row.valid_from || undefined,
    validUntil: row.valid_until || undefined,
    denialReason: row.denial_reason || undefined,
    suggestedAction: row.suggested_action || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllPriorAuthorizations(req: Request, res: Response): Promise<void> {
  try {
    const { patientId } = req.query;
    let sql = 'SELECT * FROM prior_authorizations ORDER BY created_at DESC';
    let params: any[] = [];

    if (patientId && typeof patientId === 'string' && patientId.trim()) {
      sql = 'SELECT * FROM prior_authorizations WHERE patient_id = $1 ORDER BY created_at DESC';
      params = [patientId.trim()];
    }

    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows.map(mapPriorAuthRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch prior authorizations.' });
  }
}

export async function getPriorAuthorizationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM prior_authorizations WHERE id = $1 OR LOWER(authorization_request_id) = LOWER($1)',
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Prior authorization not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapPriorAuthRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch prior authorization.' });
  }
}

export async function createPriorAuthorization(req: Request, res: Response): Promise<void> {
  try {
    const b = req.body;
    const id = b.id || `pa-${crypto.randomUUID().slice(0, 8)}`;

    let reqId = b.authorizationRequestId;
    if (!reqId) {
      const maxRes = await query(`
        SELECT authorization_request_id FROM prior_authorizations
        WHERE authorization_request_id ~ '^PA-[0-9]+$'
        ORDER BY CAST(SUBSTRING(authorization_request_id FROM 4) AS INTEGER) DESC
        LIMIT 1
      `);
      if (maxRes.rows.length > 0 && maxRes.rows[0]?.authorization_request_id) {
        const lastNum = parseInt(maxRes.rows[0].authorization_request_id.replace(/^PA-/i, ''), 10);
        reqId = `PA-${lastNum + 1}`;
      } else {
        reqId = 'PA-10001';
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO prior_authorizations (
        id, authorization_request_id, patient_id, appointment_id, service_name,
        procedure_code, diagnosis_code, doctor_id, doctor_name, department_id, department_name,
        insurance_provider, member_id, policy_number, request_date, service_date,
        estimated_cost, medical_justification, supporting_documents, authorization_required,
        status, authorization_number, approved_date, valid_from, valid_until,
        denial_reason, suggested_action, notes, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, NOW()
      ) RETURNING *`,
      [
        id,
        reqId,
        b.patientId,
        b.appointmentId || null,
        b.serviceName || '',
        b.procedureCode || '',
        b.diagnosisCode || '',
        b.doctorId || null,
        b.doctorName || '',
        b.departmentId || null,
        b.departmentName || '',
        b.insuranceProvider || '',
        b.memberId || '',
        b.policyNumber || '',
        b.requestDate || todayStr,
        b.serviceDate || todayStr,
        b.estimatedCost ?? 0,
        b.medicalJustification || '',
        JSON.stringify(b.supportingDocuments || []),
        b.authorizationRequired !== false,
        b.status || 'Pending',
        b.authorizationNumber || null,
        b.approvedDate || null,
        b.validFrom || null,
        b.validUntil || null,
        b.denialReason || null,
        b.suggestedAction || null,
        b.notes || '',
      ]
    );

    res.status(201).json({ success: true, data: mapPriorAuthRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create prior authorization.' });
  }
}

export async function updatePriorAuthorization(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const b = req.body;

    const result = await query(
      `UPDATE prior_authorizations SET
        appointment_id = COALESCE($2, appointment_id),
        service_name = COALESCE($3, service_name),
        procedure_code = COALESCE($4, procedure_code),
        diagnosis_code = COALESCE($5, diagnosis_code),
        doctor_id = COALESCE($6, doctor_id),
        doctor_name = COALESCE($7, doctor_name),
        department_id = COALESCE($8, department_id),
        department_name = COALESCE($9, department_name),
        insurance_provider = COALESCE($10, insurance_provider),
        member_id = COALESCE($11, member_id),
        policy_number = COALESCE($12, policy_number),
        request_date = COALESCE($13, request_date),
        service_date = COALESCE($14, service_date),
        estimated_cost = COALESCE($15, estimated_cost),
        medical_justification = COALESCE($16, medical_justification),
        supporting_documents = COALESCE($17, supporting_documents),
        authorization_required = COALESCE($18, authorization_required),
        status = COALESCE($19, status),
        authorization_number = COALESCE($20, authorization_number),
        approved_date = COALESCE($21, approved_date),
        valid_from = COALESCE($22, valid_from),
        valid_until = COALESCE($23, valid_until),
        denial_reason = COALESCE($24, denial_reason),
        suggested_action = COALESCE($25, suggested_action),
        notes = COALESCE($26, notes),
        updated_at = NOW()
      WHERE id = $1 OR LOWER(authorization_request_id) = LOWER($1)
      RETURNING *`,
      [
        id,
        b.appointmentId,
        b.serviceName,
        b.procedureCode,
        b.diagnosisCode,
        b.doctorId,
        b.doctorName,
        b.departmentId,
        b.departmentName,
        b.insuranceProvider,
        b.memberId,
        b.policyNumber,
        b.requestDate,
        b.serviceDate,
        b.estimatedCost,
        b.medicalJustification,
        b.supportingDocuments ? JSON.stringify(b.supportingDocuments) : null,
        b.authorizationRequired,
        b.status,
        b.authorizationNumber,
        b.approvedDate,
        b.validFrom,
        b.validUntil,
        b.denialReason,
        b.suggestedAction,
        b.notes,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Prior authorization not found.' });
      return;
    }

    res.status(200).json({ success: true, data: mapPriorAuthRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update prior authorization.' });
  }
}

export async function deletePriorAuthorization(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM prior_authorizations WHERE id = $1 OR LOWER(authorization_request_id) = LOWER($1) RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Prior authorization not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Prior authorization deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete prior authorization.' });
  }
}
