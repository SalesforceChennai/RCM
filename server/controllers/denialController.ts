import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapDenialRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    claimId: row.claim_id,
    patientId: row.patient_id,
    denialCode: row.denial_code,
    denialReason: row.denial_reason,
    denialAmount: Number(row.denial_amount || 0),
    denialStatus: row.denial_status || 'Active',
    appealStatus: row.appeal_status || 'Under Review',
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllDenials(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.query;
    let sql = 'SELECT * FROM denials ORDER BY created_at DESC';
    let params: any[] = [];

    if (claimId && typeof claimId === 'string' && claimId.trim()) {
      sql = 'SELECT * FROM denials WHERE claim_id = $1 ORDER BY created_at DESC';
      params = [claimId.trim()];
    }

    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows.map(mapDenialRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch denials.' });
  }
}

export async function createDenial(req: Request, res: Response): Promise<void> {
  try {
    const b = req.body;
    const id = b.id || `den-${crypto.randomUUID().slice(0, 8)}`;

    const result = await query(
      `INSERT INTO denials (
        id, claim_id, patient_id, denial_code, denial_reason, denial_amount,
        denial_status, appeal_status, notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        id,
        b.claimId,
        b.patientId || null,
        b.denialCode || 'CO-16',
        b.denialReason || 'Claim lacks information',
        b.denialAmount || 0,
        b.denialStatus || 'Active',
        b.appealStatus || 'Under Review',
        b.notes || '',
      ]
    );

    res.status(201).json({ success: true, data: mapDenialRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create denial.' });
  }
}

export async function updateDenial(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const b = req.body;

    const result = await query(
      `UPDATE denials
       SET denial_status = COALESCE($2, denial_status),
           appeal_status = COALESCE($3, appeal_status),
           notes = COALESCE($4, notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, b.denialStatus, b.appealStatus, b.notes]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Denial record not found.' });
      return;
    }

    res.status(200).json({ success: true, data: mapDenialRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to update denial.' });
  }
}
