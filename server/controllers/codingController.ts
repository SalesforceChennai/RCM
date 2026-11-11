import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';
import { analyzeClinicalDescription } from '../groqMedicalCoder.ts';

function mapCodingRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    encounterId: row.encounter_id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id || undefined,
    encounterDate: row.encounter_date,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    services: Array.isArray(row.services) ? row.services : [],
    diagnoses: Array.isArray(row.diagnoses) ? row.diagnoses : [],
    procedures: Array.isArray(row.procedures) ? row.procedures : [],
    codingStatus: row.coding_status,
    validationMessages: Array.isArray(row.validation_messages) ? row.validation_messages : [],
    notes: row.notes || undefined,
    updatedAt: row.updated_at,
  };
}

export async function analyzeClinical(req: Request, res: Response): Promise<void> {
  try {
    const { serviceName, notes } = req.body;
    const input = [serviceName, notes].filter(Boolean).join('. ');
    const result = await analyzeClinicalDescription(input || 'General medical examination');
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to analyze clinical description' });
  }
}

export async function getAllCodings(req: Request, res: Response): Promise<void> {
  try {
    const { patientId } = req.query;
    let sql = 'SELECT * FROM medical_coding ORDER BY created_at DESC';
    let params: any[] = [];

    if (patientId && typeof patientId === 'string' && patientId.trim()) {
      sql = 'SELECT * FROM medical_coding WHERE patient_id = $1 ORDER BY created_at DESC';
      params = [patientId.trim()];
    }

    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows.map(mapCodingRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch medical codings.' });
  }
}

export async function getCodingByPatientId(req: Request, res: Response): Promise<void> {
  try {
    const { patientId } = req.params;
    const result = await query('SELECT * FROM medical_coding WHERE patient_id = $1 OR id = $1', [patientId]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Medical coding record not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapCodingRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch medical coding.' });
  }
}

export async function saveCoding(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const id = body.id || `cod-${crypto.randomUUID().slice(0, 8)}`;

    const result = await query(
      `INSERT INTO medical_coding (
        id, encounter_id, patient_id, appointment_id, encounter_date,
        doctor_id, doctor_name, department_id, department_name,
        services, diagnoses, procedures, coding_status, validation_messages, notes, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        encounter_id = EXCLUDED.encounter_id,
        appointment_id = EXCLUDED.appointment_id,
        encounter_date = EXCLUDED.encounter_date,
        doctor_id = EXCLUDED.doctor_id,
        doctor_name = EXCLUDED.doctor_name,
        department_id = EXCLUDED.department_id,
        department_name = EXCLUDED.department_name,
        services = EXCLUDED.services,
        diagnoses = EXCLUDED.diagnoses,
        procedures = EXCLUDED.procedures,
        coding_status = EXCLUDED.coding_status,
        validation_messages = EXCLUDED.validation_messages,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        body.encounterId || id,
        body.patientId,
        body.appointmentId || null,
        body.encounterDate || new Date().toISOString().split('T')[0],
        body.doctorId || '',
        body.doctorName || '',
        body.departmentId || '',
        body.departmentName || '',
        JSON.stringify(body.services || []),
        JSON.stringify(body.diagnoses || []),
        JSON.stringify(body.procedures || []),
        body.codingStatus || 'READY FOR CLAIM CREATION',
        JSON.stringify(body.validationMessages || []),
        body.notes || '',
      ]
    );

    res.status(200).json({ success: true, data: mapCodingRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to save medical coding.' });
  }
}
