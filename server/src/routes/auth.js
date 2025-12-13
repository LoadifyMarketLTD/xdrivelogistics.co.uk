/**
 * Authentication routes
 * - POST /api/register - Register new user
 * - POST /api/login - Login existing user
 * - GET /api/verify-email - Verify email token
 */
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { sendVerificationEmail } = require('../mailer');

const router = express.Router();

// JWT secret (use strong secret in production)
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * POST /api/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
  try {
    const { account_type, email, password, company_name, full_name } = req.body;

    // Validation
    if (!email || !password || !account_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!['driver', 'shipper'].includes(account_type)) {
      return res.status(400).json({ error: 'Invalid account_type (must be driver or shipper)' });
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
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Insert user
    const insertQuery = `
      INSERT INTO users (
        account_type, email, password_hash, full_name, company_name,
        status, verify_token, verify_token_expires, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NOW(), NOW())
      RETURNING id, email, account_type, full_name, company_name, status
    `;
    
    const result = await pool.query(insertQuery, [
      account_type,
      email.toLowerCase(),
      passwordHash,
      full_name || null,
      company_name || null,
      verifyToken,
      tokenExpires,
    ]);

    const user = result.rows[0];

    // Send verification email (non-blocking)
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      // Continue anyway - user can request resend
    }

    return res.status(201).json({
      message: 'Account created successfully. Please check your email to verify.',
      user: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        status: user.status,
      },
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, account_type, full_name, company_name, status FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if verified
    if (user.status === 'pending') {
      return res.status(403).json({ 
        error: 'Email not verified. Please check your email.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account disabled' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        accountType: user.account_type,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        full_name: user.full_name,
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
 * Verify email with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // Find user with token
    const result = await pool.query(
      'SELECT id, email, verify_token_expires FROM users WHERE verify_token = $1',
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const user = result.rows[0];

    // Check expiry
    if (new Date(user.verify_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expired' });
    }

    // Update user status
    await pool.query(
      'UPDATE users SET status = $1, verify_token = NULL, verify_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      ['active', user.id]
    );

    return res.json({
      message: 'Email verified successfully. You can now login.',
      email: user.email,
    });
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
