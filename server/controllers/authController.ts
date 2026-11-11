import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { query } from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || 'rcm_super_secure_jwt_secret_key_2026_production';
const JWT_EXPIRES_IN = `${process.env.JWT_EXPIRE_MINUTES || '60'}m`;

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Name is required and must be at least 2 characters.' });
      return;
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ success: false, message: 'A valid email address is required.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: `Email '${normalizedEmail}' is already registered.` });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const userRole = role && String(role).trim().toLowerCase() === 'admin' ? 'Admin' : 'User';

    const insertResult = await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at, updated_at`,
      [id, name.trim(), normalizedEmail, passwordHash, userRole]
    );

    const user = insertResult.rows[0];
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to register user.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Both email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      access_token: token,
      token_type: 'bearer',
      user: payload,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Login failed.' });
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }

  try {
    const result = await query('SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Failed to get user profile.' });
  }
}
