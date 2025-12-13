/**
 * Minimal registration service (Node.js + Express + PostgreSQL)
 * - Hash password with bcrypt
 * - Store user with status 'pending'
 * - Create email verification token and expiry
 * - Send verification email (nodemailer)
 *
 * NOTE: production must use HTTPS, proper SMTP, env vars and rate limiting.
 */
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Basic rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests, try again later' },
});
app.use('/api/register', authLimiter);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Nodemailer transporter (use real SMTP credentials in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Utility: send verification email
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify your XDrive account',
    text: `Please verify your account: ${verifyUrl}`,
    html: `<p>Please verify your account by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
  return info;
}

// Registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { account_type, email, password } = req.body;

    // Basic validation
    if (!email || !password || !account_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (password.length < 8) return res.status(400).json({ error: 'Password too short' });
    if (!['driver', 'shipper'].includes(account_type)) return res.status(400).json({ error: 'Invalid account_type' });

    // Check if user exists
    const { rowCount } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
    if (rowCount > 0) return res.status(409).json({ error: 'Email already registered' });

    // Hash password
    const saltRounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const pwHash = await bcrypt.hash(password, saltRounds);

    // Create verification token
    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpires = new Date(Date.now() + (Number(process.env.VERIFY_TOKEN_EXPIRES_MIN || 60) * 60 * 1000)); // default 60 min

    // Insert user (status: pending)
    const insertSql = `
      INSERT INTO users (account_type, email, password_hash, status, verify_token, verify_token_expires, created_at)
      VALUES ($1, $2, $3, 'pending', $4, $5, now())
      RETURNING id, email, account_type, status
    `;
    const result = await pool.query(insertSql, [account_type, email.toLowerCase(), pwHash, token, tokenExpires]);
    const user = result.rows[0];

    // Send verification email (best effort)
    try {
      await sendVerificationEmail(email, token);
    } catch (err) {
      console.error('Email send failed:', err);
      // depending on policy, you may rollback user or leave pending and allow resend
    }

    return res.status(201).json({ message: 'Account created. Please check your email for verification.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Email verification endpoint
app.get('/api/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  try {
    const q = 'SELECT id, email, verify_token_expires FROM users WHERE verify_token = $1';
    const r = await pool.query(q, [token]);
    if (r.rowCount === 0) return res.status(400).send('Invalid token');

    const user = r.rows[0];
    if (new Date(user.verify_token_expires) < new Date()) return res.status(400).send('Token expired');

    await pool.query('UPDATE users SET status = $1, verify_token = NULL, verify_token_expires = NULL WHERE id = $2', ['active', user.id]);

    // Redirect to frontend success page (or show message)
    return res.send('Email verified — you can now login.');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Auth server listening on ${port}`));
