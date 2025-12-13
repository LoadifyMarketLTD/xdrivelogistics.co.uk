/**
 * Authentication routes: register, login, verify-email
 */
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { sendVerificationEmail } = require('../mailer');

const router = express.Router();

// JWT secret should always be set in production - no weak fallback
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-f8e2a9c4b6d1e7a3-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/register
 * Register a new user with email verification
 */
router.post('/register', async (req, res) => {
  try {
    const { account_type, email, password, company_name, phone } = req.body;

    // Validation
    if (!email || !password || !account_type) {
      return res.status(400).json({ error: 'Missing required fields: email, password, account_type' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!['driver', 'shipper'].includes(account_type)) {
      return res.status(400).json({ error: 'account_type must be "driver" or "shipper"' });
    }

    // Check if user exists
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

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExpires = new Date(
      Date.now() + (Number(process.env.VERIFY_TOKEN_EXPIRES_MIN || 60) * 60 * 1000)
    );

    // Insert user
    const insertQuery = `
      INSERT INTO users (account_type, email, password_hash, company_name, phone, status, verify_token, verify_token_expires, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NOW())
      RETURNING id, email, account_type, status, created_at
    `;
    const result = await pool.query(insertQuery, [
      account_type,
      email.toLowerCase(),
      passwordHash,
      company_name || null,
      phone || null,
      verifyToken,
      verifyTokenExpires,
    ]);

    const user = result.rows[0];

    // Send verification email (best effort)
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      // Don't fail registration if email fails
    }

    return res.status(201).json({
      message: 'Account created successfully. Please check your email for verification.',
      user: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/login
 * Login with email and password, returns JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, account_type, status, company_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({ 
        error: 'Account not verified', 
        status: user.status,
        message: 'Please verify your email before logging in'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        accountType: user.account_type,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        company_name: user.company_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/verify-email?token=xxx
 * Verify email address with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
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

    // Update user status to active
    await pool.query(
      'UPDATE users SET status = $1, verify_token = NULL, verify_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      ['active', user.id]
    );

    return res.json({
      message: 'Email verified successfully. You can now log in.',
      email: user.email,
    });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
