/**
 * Authentication routes: register, login, verify-email
 * Authentication routes
 * - POST /api/register - Register new user
 * - POST /api/login - Login existing user
 * - GET /api/verify-email - Verify email token
 */
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
 * Authentication routes: register, login, verify-email
 */
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { sendVerificationEmail } = require('../mailer');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/register
 * Create new user account with email verification
 */
router.post('/register', async (req, res) => {
  try {
    const { account_type, email, password } = req.body;
/**
 * POST /api/auth/register
 * Register a new user (driver or shipper)
 */
router.post('/register', async (req, res) => {
  try {
    const { account_type, email, password } = req.body;
// JWT secret (MUST be provided in production)
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'dev-secret-only-for-local-testing';
})();

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
      return res.status(400).json({ error: 'Invalid account_type. Must be "driver" or "shipper"' });
      return res.status(400).json({ error: 'Invalid account_type. Must be driver or shipper' });
    }

    // Check if email already exists
      return res.status(400).json({ error: 'Invalid account_type (must be driver or shipper)' });
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
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 12);
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (account_type, email, password_hash, status, verify_token, verify_token_expires, created_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, NOW())
       RETURNING id, email, account_type, status, created_at`,
      [account_type, email.toLowerCase(), passwordHash, verifyToken, tokenExpires]
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

    // Send verification email (best-effort)
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (emailError) {
      console.error('Email send failed, but user created:', emailError);
      // Don't fail registration if email fails - user can resend later
    }

    return res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
    // Send verification email (best effort)
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue - user is created, they can request resend
    }

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
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
      full_name || null,
      company_name || null,
      verifyToken,
      tokenExpires,
      company_name || null,
      phone || null,
      verifyToken,
      verifyTokenExpires,
    ]);

    const user = result.rows[0];

    // Send verification email (non-blocking)
    // Send verification email (best effort)
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      // Continue anyway - user can request resend
    }

    return res.status(201).json({
      message: 'Account created successfully. Please check your email to verify.',
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
  } catch (error) {
    console.error('Registration error:', error);
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
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/login
 * Authenticate user and return JWT
 * Login with email and password
 * Login with email and password, returns JWT
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, account_type, status FROM users WHERE email = $1',
      'SELECT id, email, password_hash, account_type, full_name, company_name, status FROM users WHERE email = $1',
      'SELECT id, email, password_hash, account_type, status, company_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if account is verified
    if (user.status === 'pending') {
      return res.status(403).json({ 
        error: 'Account not verified. Please check your email for the verification link.',
        status: 'pending'
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if verified
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
      return res.status(403).json({ 
        error: 'Email not verified. Please check your email.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account has been disabled' });
    }

    // Return user info (in production, generate JWT token here)
    res.json({
      message: 'Login successful',
      return res.status(403).json({ error: 'Account disabled' });
    }

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
      { expiresIn: '7d' }
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        account_type: user.account_type,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
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
 * Verify email address
 * Verify email with token
 * Verify email address with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user by token
      return res.status(400).json({ error: 'Token required' });
    }

    // Validate token format (should be hex string of appropriate length)
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with token
    const result = await pool.query(
      'SELECT id, email, verify_token_expires FROM users WHERE verify_token = $1',
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
      return res.status(400).json({ error: 'Invalid or expired token' });
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const user = result.rows[0];

    // Check if token expired
    if (new Date(user.verify_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token expired' });
    // Check expiry
    if (new Date(user.verify_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expired' });
    }

    // Update user status
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
    // Update user status to active
    await pool.query(
      'UPDATE users SET status = $1, verify_token = NULL, verify_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      ['active', user.id]
    );

    return res.json({
      message: 'Email verified successfully! You can now log in.',
      email: user.email,
    });
  } catch (error) {
    console.error('Verification error:', error);
      message: 'Email verified successfully. You can now login.',
      email: user.email,
    });
  } catch (err) {
    console.error('Verify email error:', err);
      message: 'Email verified successfully. You can now log in.',
      email: user.email,
    });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
