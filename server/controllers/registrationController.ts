import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapRegistrationRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id || undefined,
    idType: row.id_type,
    idNumber: row.id_number || '',
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactRelationship: row.emergency_contact_relationship || '',
    emergencyContactPhone: row.emergency_contact_phone || '',
    registrationDate: row.registration_date,
    registrationStatus: row.registration_status,
    notes: row.notes || undefined,
    updatedAt: row.updated_at,
  };
}

export async function getAllRegistrations(_req: Request, res: Response): Promise<void> {
  try {
    const result = await query('SELECT * FROM registrations ORDER BY created_at DESC');
    res.status(200).json({ success: true, data: result.rows.map(mapRegistrationRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch registrations.' });
  }
}

export async function getRegistrationByPatientId(req: Request, res: Response): Promise<void> {
  try {
    const { patientId } = req.params;
    const result = await query('SELECT * FROM registrations WHERE patient_id = $1 OR id = $1', [patientId]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Registration not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapRegistrationRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch registration.' });
  }
}

export async function saveRegistration(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const id = body.id || `reg-${crypto.randomUUID().slice(0, 8)}`;
    const patientId = body.patientId;

    if (!patientId) {
      res.status(400).json({ success: false, message: 'patientId is required' });
      return;
    }

    const result = await query(
      `INSERT INTO registrations (
        id, patient_id, appointment_id, id_type, id_number,
        emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
        registration_date, registration_status, notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (patient_id) DO UPDATE SET
        appointment_id = COALESCE(EXCLUDED.appointment_id, registrations.appointment_id),
        id_type = EXCLUDED.id_type,
        id_number = EXCLUDED.id_number,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_relationship = EXCLUDED.emergency_contact_relationship,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
        registration_status = EXCLUDED.registration_status,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        patientId,
        body.appointmentId || null,
        body.idType || 'National ID',
        body.idNumber || '',
        body.emergencyContactName || '',
        body.emergencyContactRelationship || '',
        body.emergencyContactPhone || '',
        body.registrationDate || new Date().toISOString().split('T')[0],
        body.registrationStatus || 'Registered',
        body.notes || '',
      ]
    );

    res.status(200).json({ success: true, data: mapRegistrationRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to save registration.' });
  }
}
