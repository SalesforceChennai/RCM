import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapPatientRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dob: row.dob,
    gender: row.gender,
    phone: row.phone,
    email: row.email || '',
    address: row.address || '',
    avatar: row.avatar || '',
    bloodGroup: row.blood_group || '',
    emergencyContact: row.emergency_contact || '',
  };
}

export async function getAllPatients(req: Request, res: Response): Promise<void> {
  try {
    const search = req.query.search as string;
    let sql = 'SELECT * FROM patients ORDER BY created_at DESC';
    let params: any[] = [];

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql = `SELECT * FROM patients WHERE
             LOWER(first_name) LIKE $1 OR
             LOWER(last_name) LIKE $1 OR
             LOWER(patient_id) LIKE $1 OR
             LOWER(phone) LIKE $1 OR
             LOWER(email) LIKE $1
             ORDER BY created_at DESC`;
      params = [term];
    }

    const result = await query(sql, params);
    const data = result.rows.map(mapPatientRow);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch patients.' });
  }
}

export async function getPatientById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM patients WHERE id = $1 OR LOWER(patient_id) = LOWER($1)', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Patient not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapPatientRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch patient.' });
  }
}

export async function createPatient(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const cleanFirst = (body.firstName || '').trim();
    const cleanLast = (body.lastName || '').trim();
    const cleanPhone = (body.phone || '').trim();
    const cleanEmail = (body.email || '').trim().toLowerCase();

    if (!cleanFirst || !cleanLast || !cleanPhone) {
      res.status(400).json({
        success: false,
        message: 'First name, last name, and phone number are required.'
      });
      return;
    }

    // Duplicate prevention: check if patient already exists
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
      const existing = existingRes.rows[0];
      res.status(200).json({
        success: true,
        data: mapPatientRow(existing),
        isExisting: true,
        message: `Patient already registered with ID ${existing.patient_id}.`
      });
      return;
    }

    const id = body.id || `pat-${crypto.randomUUID().slice(0, 8)}`;
    let patientId = body.patientId;
    if (!patientId) {
      try {
        const maxRes = await query(`
          SELECT patient_id FROM patients 
          WHERE patient_id ~ '^PAT-[0-9]+$' 
          ORDER BY CAST(SUBSTRING(patient_id FROM 5) AS INTEGER) DESC 
          LIMIT 1
        `);
        if (maxRes.rows.length > 0 && maxRes.rows[0]?.patient_id) {
          const lastNum = parseInt(maxRes.rows[0].patient_id.replace('PAT-', ''), 10);
          patientId = `PAT-${lastNum + 1}`;
        } else {
          patientId = `PAT-${Math.floor(1000 + Math.random() * 9000)}`;
        }
      } catch {
        patientId = `PAT-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    const result = await query(
      `INSERT INTO patients (id, patient_id, first_name, last_name, dob, gender, phone, email, address, avatar, blood_group, emergency_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        patientId,
        cleanFirst,
        cleanLast,
        body.dob || '',
        body.gender || 'Other',
        cleanPhone,
        cleanEmail,
        body.address || '',
        body.avatar || '',
        body.bloodGroup || '',
        body.emergencyContact || '',
      ]
    );

    res.status(201).json({ success: true, data: mapPatientRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create patient.' });
  }
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body;

    const result = await query(
      `UPDATE patients
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           dob = COALESCE($4, dob),
           gender = COALESCE($5, gender),
           phone = COALESCE($6, phone),
           email = COALESCE($7, email),
           address = COALESCE($8, address),
           avatar = COALESCE($9, avatar),
           blood_group = COALESCE($10, blood_group),
           emergency_contact = COALESCE($11, emergency_contact),
           updated_at = NOW()
       WHERE id = $1 OR LOWER(patient_id) = LOWER($1)
       RETURNING *`,
      [
        id,
        body.firstName,
        body.lastName,
        body.dob,
        body.gender,
        body.phone,
        body.email,
        body.address,
        body.avatar,
        body.bloodGroup,
        body.emergencyContact,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Patient not found.' });
      return;
    }

    res.status(200).json({ success: true, data: mapPatientRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update patient.' });
  }
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM patients WHERE id = $1 OR LOWER(patient_id) = LOWER($1) RETURNING id', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Patient not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Patient deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete patient.' });
  }
}
