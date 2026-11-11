import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled server error:', err);

  const statusCode = typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  res.status(statusCode).json({
    success: false,
    message: err?.message || 'An unexpected internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });
}
