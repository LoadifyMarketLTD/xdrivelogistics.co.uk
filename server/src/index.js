/**
 * XDrive Logistics Backend API
 * Express server with PostgreSQL integration
 */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.js';
import bookingsRoutes from './routes/bookings.js';
import invoicesRoutes from './routes/invoices.js';
import reportsRoutes from './routes/reports.js';
import feedbackRoutes from './routes/feedback.js';

// Import database to test connection on startup
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
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

// API routes
// Apply rate limiter only to auth routes
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/verify-email', authLimiter);

// Mount auth routes
app.use('/api', authRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/feedback', feedbackRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'XDrive Logistics API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/register',
        login: 'POST /api/login',
        verifyEmail: 'GET /api/verify-email?token=xxx',
      },
      bookings: {
        list: 'GET /api/bookings',
        get: 'GET /api/bookings/:id',
        create: 'POST /api/bookings',
        update: 'PUT /api/bookings/:id',
        delete: 'DELETE /api/bookings/:id',
      },
      invoices: {
        list: 'GET /api/invoices',
        get: 'GET /api/invoices/:id',
        create: 'POST /api/invoices',
        update: 'PUT /api/invoices/:id',
      },
      reports: {
        grossMargin: 'GET /api/reports/gross-margin?from=YYYY-MM-DD&to=YYYY-MM-DD',
        bookingsByStatus: 'GET /api/reports/bookings-by-status',
      },
      feedback: {
        list: 'GET /api/feedback',
        get: 'GET /api/feedback/:id',
        create: 'POST /api/feedback',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   XDrive Logistics API Server         ║
╚═══════════════════════════════════════╝
  
  🚀 Server running on port ${PORT}
  📊 Environment: ${process.env.NODE_ENV || 'development'}
  🌐 API URL: http://localhost:${PORT}
  📝 Health check: http://localhost:${PORT}/health
  
  Ready to accept requests...
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

export default app;
