/**
 * Authentication routes
 * - POST /api/register - Register new user
 * - POST /api/login - Login user
 * - GET /api/verify-email - Verify email with token
 */
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../db.js';
import { sendVerificationEmail } from '../mailer.js';

const router = express.Router();

/**
 * POST /api/register
 * Register a new user with email verification
 */
router.post('/register', async (req, res) => {
  try {
    const { account_type, email, password } = req.body;

    // Validation
    if (!email || !password || !account_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // More strict email validation (RFC 5322 compliant)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 320) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!['driver', 'shipper'].includes(account_type)) {
      return res.status(400).json({ error: 'Invalid account_type. Must be "driver" or "shipper"' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(
      Date.now() + Number(process.env.VERIFY_TOKEN_EXPIRES_MIN || 60) * 60 * 1000
    );

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (account_type, email, password_hash, status, verify_token, verify_token_expires, created_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, NOW())
       RETURNING id, email, account_type, status`,
      [account_type, email.toLowerCase(), passwordHash, verifyToken, tokenExpires]
    );

    const user = result.rows[0];

    // Send verification email (best effort)
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      // Continue - user is created, they can request a new verification email
    }

    return res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      userId: user.id,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, account_type, status FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if email is verified
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account is disabled. Please contact support.' });
    }

    // Update last login
    await pool.query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

    // Return user info (in production, generate JWT token here)
    return res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        accountType: user.account_type,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/verify-email?token=xxx
 * Verify email with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // Find user with token
    const result = await pool.query(
      'SELECT id, email, verify_token_expires FROM users WHERE verify_token = $1',
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const user = result.rows[0];

    // Check if token expired
    if (new Date(user.verify_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Activate user
    await pool.query(
      'UPDATE users SET status = $1, verify_token = NULL, verify_token_expires = NULL WHERE id = $2',
      ['active', user.id]
    );

    return res.json({
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
