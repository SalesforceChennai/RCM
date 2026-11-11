import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapAppointmentRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    appointmentCode: row.appointment_code,
    patientId: row.patient_id,
    patient: {
      id: row.p_id || row.patient_id,
      patientCode: row.p_code || row.patient_id,
      name: `${row.p_first || ''} ${row.p_last || ''}`.trim() || 'Patient',
      phone: row.p_phone || '',
      avatar: row.p_avatar || '',
      gender: row.p_gender || 'Other',
      dob: row.p_dob || '',
      email: row.p_email || '',
      address: row.p_address || '',
    },
    doctorId: row.doctor_id,
    doctor: {
      id: row.d_id || row.doctor_id,
      name: row.d_name || 'Assigned Physician',
      avatar: row.d_avatar || '',
      department: row.d_dept || row.department_name || '',
    },
    departmentId: row.department_id || '',
    departmentName: row.department_name || '',
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    durationMinutes: row.duration_minutes || 30,
    appointmentType: row.appointment_type || 'Consultation',
    status: row.status || 'Confirmed',
    reasonForVisit: row.reason_for_visit || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

const APPOINTMENT_BASE_SELECT = `
  SELECT 
    a.*,
    p.id as p_id, p.patient_id as p_code, p.first_name as p_first, p.last_name as p_last,
    p.phone as p_phone, p.avatar as p_avatar, p.gender as p_gender, p.dob as p_dob,
    p.email as p_email, p.address as p_address,
    d.id as d_id, d.name as d_name, d.avatar as d_avatar, d.department_name as d_dept
  FROM appointments a
  LEFT JOIN patients p ON a.patient_id = p.id
  LEFT JOIN doctors d ON a.doctor_id = d.id
`;

export async function getAllAppointments(req: Request, res: Response): Promise<void> {
  try {
    const { searchQuery, doctorId, departmentId, status, date, startDate, endDate, month } = req.query;

    let conditions: string[] = [];
    let params: any[] = [];
    let idx = 1;

    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
      conditions.push(`(
        LOWER(a.appointment_code) LIKE $${idx} OR
        LOWER(p.first_name) LIKE $${idx} OR
        LOWER(p.last_name) LIKE $${idx} OR
        LOWER(CONCAT(p.first_name, ' ', p.last_name)) LIKE $${idx} OR
        LOWER(p.patient_id) LIKE $${idx} OR
        LOWER(d.name) LIKE $${idx}
      )`);
      params.push(`%${searchQuery.trim().toLowerCase()}%`);
      idx++;
    }

    if (doctorId && typeof doctorId === 'string' && doctorId.trim() && doctorId !== 'All') {
      conditions.push(`a.doctor_id = $${idx}`);
      params.push(doctorId.trim());
      idx++;
    }

    if (departmentId && typeof departmentId === 'string' && departmentId.trim() && departmentId !== 'All') {
      conditions.push(`(
        a.department_id = $${idx} OR
        d.department_id = $${idx} OR
        LOWER(a.department_name) = LOWER($${idx}) OR
        LOWER(d.department_name) = LOWER($${idx})
      )`);
      params.push(departmentId.trim());
      idx++;
    }

    if (status && typeof status === 'string' && status.trim() && status !== 'All') {
      conditions.push(`LOWER(a.status) = LOWER($${idx})`);
      params.push(status.trim());
      idx++;
    }

    if (date && typeof date === 'string' && date.trim()) {
      conditions.push(`a.appointment_date = $${idx}`);
      params.push(date.trim());
      idx++;
    }

    if (month && typeof month === 'string' && month.trim()) {
      conditions.push(`a.appointment_date LIKE $${idx}`);
      params.push(`${month.trim()}%`);
      idx++;
    }

    if (startDate && typeof startDate === 'string' && startDate.trim()) {
      conditions.push(`a.appointment_date >= $${idx}`);
      params.push(startDate.trim());
      idx++;
    }

    if (endDate && typeof endDate === 'string' && endDate.trim()) {
      conditions.push(`a.appointment_date <= $${idx}`);
      params.push(endDate.trim());
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `${APPOINTMENT_BASE_SELECT} ${whereClause} ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

    const result = await query(sql, params);
    const data = result.rows.map(mapAppointmentRow);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch appointments.' });
  }
}

export async function getAppointmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const sql = `${APPOINTMENT_BASE_SELECT} WHERE a.id = $1 OR LOWER(a.appointment_code) = LOWER($1)`;
    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapAppointmentRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch appointment.' });
  }
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    const id = body.id || `apt-${crypto.randomUUID().slice(0, 8)}`;
    const appointmentCode = body.appointmentCode || `APT${Math.floor(10000 + Math.random() * 90000)}`;

    await query(
      `INSERT INTO appointments (
        id, appointment_code, patient_id, doctor_id, department_id, department_name,
        appointment_date, appointment_time, duration_minutes, appointment_type, status,
        reason_for_visit, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id,
        appointmentCode,
        body.patientId,
        body.doctorId,
        body.departmentId || null,
        body.departmentName || '',
        body.appointmentDate,
        body.appointmentTime,
        body.durationMinutes || 30,
        body.appointmentType || 'Consultation',
        body.status || 'Confirmed',
        body.reasonForVisit || '',
        body.notes || '',
      ]
    );

    const fullResult = await query(`${APPOINTMENT_BASE_SELECT} WHERE a.id = $1`, [id]);
    res.status(201).json({ success: true, data: mapAppointmentRow(fullResult.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create appointment.' });
  }
}

export async function updateAppointmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await query(
      `UPDATE appointments SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id, status]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }

    const fullResult = await query(`${APPOINTMENT_BASE_SELECT} WHERE a.id = $1`, [id]);
    res.status(200).json({ success: true, data: mapAppointmentRow(fullResult.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update appointment status.' });
  }
}

export async function updateAppointment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body;

    const result = await query(
      `UPDATE appointments
       SET doctor_id = COALESCE($2, doctor_id),
           department_id = COALESCE($3, department_id),
           department_name = COALESCE($4, department_name),
           appointment_date = COALESCE($5, appointment_date),
           appointment_time = COALESCE($6, appointment_time),
           duration_minutes = COALESCE($7, duration_minutes),
           appointment_type = COALESCE($8, appointment_type),
           status = COALESCE($9, status),
           reason_for_visit = COALESCE($10, reason_for_visit),
           notes = COALESCE($11, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [
        id,
        body.doctorId,
        body.departmentId,
        body.departmentName,
        body.appointmentDate,
        body.appointmentTime,
        body.durationMinutes,
        body.appointmentType,
        body.status,
        body.reasonForVisit,
        body.notes,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }

    const fullResult = await query(`${APPOINTMENT_BASE_SELECT} WHERE a.id = $1`, [id]);
    res.status(200).json({ success: true, data: mapAppointmentRow(fullResult.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update appointment.' });
  }
}

export async function deleteAppointment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM appointments WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Appointment deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete appointment.' });
  }
}
