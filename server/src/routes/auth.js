/**
 * Authentication routes: register, login, verify-email
 */
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { sendVerificationEmail } = require('../mailer');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (driver or shipper)
 */
router.post('/register', async (req, res) => {
  try {
    const { account_type, email, password } = req.body;

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
      return res.status(400).json({ error: 'Invalid account_type. Must be driver or shipper' });
    }

    // Check if email already exists
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
    const tokenExpiresMin = Number(process.env.VERIFY_TOKEN_EXPIRES_MIN || 60);
    const verifyTokenExpires = new Date(Date.now() + tokenExpiresMin * 60 * 1000);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (account_type, email, password_hash, status, verify_token, verify_token_expires, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, NOW(), NOW())
       RETURNING id, email, account_type, status, created_at`,
      [account_type, email.toLowerCase(), passwordHash, verifyToken, verifyTokenExpires]
    );

    const user = result.rows[0];

    // Send verification email (best effort)
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue - user is created, they can request resend
    }

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        status: user.status,
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
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
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is verified
    if (user.status === 'pending') {
      return res.status(403).json({ 
        error: 'Account not verified. Please check your email for the verification link.',
        status: 'pending'
      });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account has been disabled' });
    }

    // Return user info (in production, generate JWT token here)
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
        status: user.status,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/verify-email?token=xxx
 * Verify email with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user by token
    const result = await pool.query(
      'SELECT id, email, verify_token_expires FROM users WHERE verify_token = $1',
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const user = result.rows[0];

    // Check if token expired
    if (new Date(user.verify_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Activate user
    await pool.query(
      `UPDATE users 
       SET status = 'active', verify_token = NULL, verify_token_expires = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    res.json({
      message: 'Email verified successfully. You can now log in.',
      email: user.email
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
