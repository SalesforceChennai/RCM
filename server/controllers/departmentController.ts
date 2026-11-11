import type { Request, Response } from 'express';
import { query } from '../db.ts';

function mapDepartmentRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || 'stethoscope',
    color: row.color || '#3B82F6',
    description: row.description || '',
    status: row.status || 'Active',
    doctorCount: row.doctor_count !== undefined ? Number(row.doctor_count) : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllDepartments(_req: Request, res: Response): Promise<void> {
  try {
    const result = await query(`
      SELECT 
        d.id, 
        d.name, 
        d.icon, 
        d.color, 
        d.description, 
        d.status,
        d.created_at,
        d.updated_at,
        COUNT(doc.id)::int AS doctor_count
      FROM departments d
      LEFT JOIN doctors doc ON (doc.department_id = d.id OR doc.department_name = d.name)
      GROUP BY d.id
      ORDER BY d.name ASC
    `);
    const data = result.rows.map(mapDepartmentRow);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch departments.' });
  }
}

export async function getDepartmentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        d.id, 
        d.name, 
        d.icon, 
        d.color, 
        d.description, 
        d.status,
        d.created_at,
        d.updated_at,
        COUNT(doc.id)::int AS doctor_count
      FROM departments d
      LEFT JOIN doctors doc ON (doc.department_id = d.id OR doc.department_name = d.name)
      WHERE d.id = $1
      GROUP BY d.id
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }
    res.status(200).json({ success: true, data: mapDepartmentRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch department.' });
  }
}

export async function createDepartment(req: Request, res: Response): Promise<void> {
  try {
    const { id, name, icon, color, description, status } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Department name is required.' });
      return;
    }

    const deptId = id || `dept-${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;

    const result = await query(
      `INSERT INTO departments (id, name, icon, color, description, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         icon = EXCLUDED.icon,
         color = EXCLUDED.color,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [deptId, name.trim(), icon || 'stethoscope', color || '#3B82F6', description || '', status || 'Active']
    );

    res.status(201).json({ success: true, data: mapDepartmentRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create department.' });
  }
}

export async function updateDepartment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, icon, color, description, status } = req.body;

    const result = await query(
      `UPDATE departments
       SET name = COALESCE($1, name),
           icon = COALESCE($2, icon),
           color = COALESCE($3, color),
           description = COALESCE($4, description),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name?.trim(), icon, color, description, status, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }

    res.status(200).json({ success: true, data: mapDepartmentRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update department.' });
  }
}

export async function deleteDepartment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await query(`DELETE FROM departments WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Department not found.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Department deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to delete department.' });
  }
}
