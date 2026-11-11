import type { Request, Response } from 'express';
import { checkConnection } from '../db.ts';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  try {
    const conn = await checkConnection();

    if (conn.connected) {
      res.status(200).json({
        status: 'ok',
        database: 'connected',
      });
      return;
    }

    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: conn.error,
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err?.message || 'Database connection check failed',
    });
  }
}
