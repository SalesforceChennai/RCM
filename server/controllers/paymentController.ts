import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapPaymentRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    encounterId: row.encounter_id || undefined,
    claimId: row.claim_id || undefined,
    patientId: row.patient_id,
    source: row.source || 'Insurance',
    paymentType: row.payment_type,
    payer: row.payer || '',
    amount: Number(row.amount || 0),
    paymentDate: row.payment_date,
    status: row.status || 'Completed',
    referenceNumber: row.reference_number || '',
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export async function getAllPayments(req: Request, res: Response): Promise<void> {
  try {
    const { patientId, claimId } = req.query;
    let sql = 'SELECT * FROM payments ORDER BY created_at DESC';
    let params: any[] = [];

    if (patientId && typeof patientId === 'string' && patientId.trim()) {
      sql = 'SELECT * FROM payments WHERE patient_id = $1 ORDER BY created_at DESC';
      params = [patientId.trim()];
    } else if (claimId && typeof claimId === 'string' && claimId.trim()) {
      sql = 'SELECT * FROM payments WHERE claim_id = $1 ORDER BY created_at DESC';
      params = [claimId.trim()];
    }

    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows.map(mapPaymentRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch payments.' });
  }
}

export async function createPayment(req: Request, res: Response): Promise<void> {
  try {
    const b = req.body;
    const id = b.id || `pay-${crypto.randomUUID().slice(0, 8)}`;

    const result = await query(
      `INSERT INTO payments (
        id, encounter_id, claim_id, patient_id, source, payment_type, payer,
        amount, payment_date, status, reference_number, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        id,
        b.encounterId || null,
        b.claimId || null,
        b.patientId || null,
        b.source || 'Insurance',
        b.paymentType || 'Payment',
        b.payer || '',
        b.amount || 0,
        b.paymentDate || new Date().toISOString().split('T')[0],
        b.status || 'Completed',
        b.referenceNumber || `REF-${Math.floor(10000 + Math.random() * 90000)}`,
        b.notes || '',
      ]
    );

    res.status(201).json({ success: true, data: mapPaymentRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to create payment.' });
  }
}
