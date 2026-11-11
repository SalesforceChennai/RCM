import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapDoctorRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
    departmentName: row.department_name || '',
    avatar: row.avatar || '',
    specialization: row.specialization || '',
    workingHours: typeof row.working_hours === 'object' && row.working_hours !== null
      ? row.working_hours
      : { start: '09:00 AM', end: '05:00 PM' },
    roomNumber: row.room_number || '',
    experience: row.experience || '',
  };
}

export async function getAllDoctors(req: Request, res: Response): Promise<void> {
  try {
    const departmentId = req.query.departmentId as string;
    let sql = 'SELECT * FROM doctors ORDER BY name ASC';
    let params: any[] = [];

    if (departmentId && departmentId.trim()) {
      sql = 'SELECT * FROM doctors WHERE department_id = $1 ORDER BY name ASC';
      params = [departmentId.trim()];
    }

    const result = await query(sql, params);
    const data = result.rows.map(mapDoctorRow);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch doctors.' });
  }
}

export async function getDoctorById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM doctors WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Doctor not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapDoctorRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch doctor.' });
  }
}

export async function createDoctor(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const id = body.id || `doc-${crypto.randomUUID().slice(0, 8)}`;

    const result = await query(
      `INSERT INTO doctors (id, name, department_id, department_name, avatar, specialization, working_hours, room_number, experience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        body.name || '',
        body.departmentId || null,
        body.departmentName || '',
        body.avatar || '',
        body.specialization || '',
        JSON.stringify(body.workingHours || { start: '09:00 AM', end: '05:00 PM' }),
        body.roomNumber || '',
        body.experience || '',
      ]
    );

    res.status(201).json({ success: true, data: mapDoctorRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create doctor.' });
  }
}

export async function updateDoctor(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body;

    const result = await query(
      `UPDATE doctors
       SET name = COALESCE($2, name),
           department_id = COALESCE($3, department_id),
           department_name = COALESCE($4, department_name),
           avatar = COALESCE($5, avatar),
           specialization = COALESCE($6, specialization),
           working_hours = COALESCE($7, working_hours),
           room_number = COALESCE($8, room_number),
           experience = COALESCE($9, experience),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        body.name,
        body.departmentId,
        body.departmentName,
        body.avatar,
        body.specialization,
        body.workingHours ? JSON.stringify(body.workingHours) : null,
        body.roomNumber,
        body.experience,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Doctor not found.' });
      return;
    }

    res.status(200).json({ success: true, data: mapDoctorRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update doctor.' });
  }
}

export async function deleteDoctor(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM doctors WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Doctor not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Doctor deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete doctor.' });
  }
}
