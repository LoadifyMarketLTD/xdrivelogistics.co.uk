/**
 * XDrive Logistics - Backend API Server
 * Express application with PostgreSQL database
 */
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const bookingsRoutes = require('./routes/bookings');
const invoicesRoutes = require('./routes/invoices');
const reportsRoutes = require('./routes/reports');
const feedbackRoutes = require('./routes/feedback');

// Import database connection
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration - restrictive default, explicit config required for production
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many authentication requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to auth routes
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message,
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'XDrive Logistics API',
    version: '1.0.0',
    endpoints: {
      auth: [
        'POST /api/register',
        'POST /api/login',
        'GET /api/verify-email',
      ],
      bookings: [
        'GET /api/bookings',
        'GET /api/bookings/:id',
        'POST /api/bookings',
        'PUT /api/bookings/:id',
        'DELETE /api/bookings/:id',
      ],
      invoices: [
        'GET /api/invoices',
        'GET /api/invoices/:id',
        'POST /api/invoices',
        'PUT /api/invoices/:id',
      ],
      reports: [
        'GET /api/reports/gross-margin',
        'GET /api/reports/bookings-by-status',
        'GET /api/reports/revenue-by-month',
      ],
      feedback: [
        'GET /api/feedback',
        'GET /api/feedback/:id',
        'POST /api/feedback',
      ],
    },
  });
});

// Mount routes
app.use('/api', authRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/feedback', feedbackRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║  XDrive Logistics API Server          ║
║  Port: ${PORT}                           ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
╚════════════════════════════════════════╝
  `);
  console.log(`API available at: http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await pool.end();
  process.exit(0);
});
