import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.ts';

function mapPredictionRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    claimId: row.claim_id,
    prediction: row.prediction,
    probability: Number(row.probability),
    riskLevel: row.risk_level,
    votesPaid: row.votes_paid,
    votesUnpaid: row.votes_unpaid,
    votesTotal: row.votes_total,
    topFactors: Array.isArray(row.top_factors) ? row.top_factors : [],
    inputFeatures: typeof row.input_features === 'object' ? row.input_features : {},
    createdAt: row.created_at,
  };
}

export async function getAllPredictions(req: Request, res: Response): Promise<void> {
  try {
    const { claimId } = req.query;
    let sql = 'SELECT * FROM payment_predictions ORDER BY created_at DESC';
    let params: any[] = [];

    if (claimId && typeof claimId === 'string' && claimId.trim()) {
      sql = 'SELECT * FROM payment_predictions WHERE claim_id = $1 ORDER BY created_at DESC';
      params = [claimId.trim()];
    }

    const result = await query(sql, params);
    res.status(200).json({ success: true, data: result.rows.map(mapPredictionRow) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch predictions.' });
  }
}

export async function savePrediction(req: Request, res: Response): Promise<void> {
  try {
    const b = req.body;
    const id = b.id || `pred-${crypto.randomUUID().slice(0, 8)}`;

    const result = await query(
      `INSERT INTO payment_predictions (
        id, claim_id, prediction, probability, risk_level, votes_paid, votes_unpaid,
        votes_total, top_factors, input_features, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        id,
        b.claimId || null,
        b.prediction || 'Paid',
        b.probability || 0.85,
        b.riskLevel || 'Low Risk',
        b.votesPaid || 0,
        b.votesUnpaid || 0,
        b.votesTotal || 0,
        JSON.stringify(b.topFactors || []),
        JSON.stringify(b.inputFeatures || {}),
      ]
    );

    // Also update claim record if claimId exists
    if (b.claimId) {
      await query(
        `UPDATE claims SET
          predicted_status = $2,
          payment_probability = $3,
          risk_level = $4,
          updated_at = NOW()
        WHERE claim_id = $1`,
        [b.claimId, b.prediction, b.probability, b.riskLevel]
      );
    }

    res.status(201).json({ success: true, data: mapPredictionRow(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to save prediction.' });
  }
}

export async function getPredictionStats(_req: Request, res: Response): Promise<void> {
  try {
    const totalClaims = await query('SELECT COUNT(*) FROM claims');
    const totalCount = parseInt(totalClaims.rows[0].count, 10);

    const paidClaims = await query("SELECT COUNT(*) FROM claims WHERE predicted_status = 'Paid'");
    const unpaidClaims = await query("SELECT COUNT(*) FROM claims WHERE predicted_status = 'Unpaid'");
    const highRisk = await query("SELECT COUNT(*) FROM claims WHERE risk_level = 'High Risk'");

    res.status(200).json({
      success: true,
      data: {
        totalClaimsAnalyzed: totalCount,
        predictedPaidClaims: parseInt(paidClaims.rows[0].count, 10),
        predictedUnpaidClaims: parseInt(unpaidClaims.rows[0].count, 10),
        highRiskClaimsCount: parseInt(highRisk.rows[0].count, 10),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to fetch prediction stats.' });
  }
}
