require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const vehicleRoutes = require('./routes/vehicles');
const jobRoutes = require('./routes/jobs');
const quoteRoutes = require('./routes/quotes');
const invoiceRoutes = require('./routes/invoices');
const clientRoutes = require('./routes/clients');
const driverAppRoutes = require('./routes/driver-app');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Strict rate limit for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// General rate limit for all other API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'xdrive-backend' });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/drivers', apiLimiter, driverRoutes);
app.use('/api/vehicles', apiLimiter, vehicleRoutes);
app.use('/api/jobs', apiLimiter, jobRoutes);
app.use('/api/quotes', apiLimiter, quoteRoutes);
app.use('/api/invoices', apiLimiter, invoiceRoutes);
app.use('/api/clients', apiLimiter, clientRoutes);
app.use('/api/driver', apiLimiter, driverAppRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`XDrive backend running on port ${PORT}`);
});
