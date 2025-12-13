/**
 * Reports routes
 * - GET /api/reports/gross-margin - Calculate gross margin and subcontract spend
 */
import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/reports/gross-margin?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calculate gross margin total and subcontract spend from bookings
 */
router.get('/gross-margin', async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_bookings,
        SUM(price) as total_revenue,
        SUM(subcontract_cost) as subcontract_spend,
        SUM(price - COALESCE(subcontract_cost, 0)) as gross_margin_total,
        AVG(price - COALESCE(subcontract_cost, 0)) as avg_margin_per_booking
      FROM bookings 
      WHERE status = 'delivered'
    `;

    const params = [];
    let paramCount = 1;

    if (from) {
      query += ` AND pickup_date >= $${paramCount}`;
      params.push(from);
      paramCount++;
    }

    if (to) {
      query += ` AND delivery_date <= $${paramCount}`;
      params.push(to);
      paramCount++;
    }

    const result = await pool.query(query, params);
    const data = result.rows[0];

    // Format the response
    return res.json({
      period: {
        from: from || 'all',
        to: to || 'all',
      },
      metrics: {
        totalBookings: parseInt(data.total_bookings) || 0,
        totalRevenue: parseFloat(data.total_revenue) || 0,
        subcontractSpend: parseFloat(data.subcontract_spend) || 0,
        grossMarginTotal: parseFloat(data.gross_margin_total) || 0,
        avgMarginPerBooking: parseFloat(data.avg_margin_per_booking) || 0,
      },
    });
  } catch (err) {
    console.error('Gross margin report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/bookings-by-status
 * Get booking counts grouped by status
 */
router.get('/bookings-by-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM bookings 
      GROUP BY status 
      ORDER BY count DESC
    `);

    return res.json({
      statusCounts: result.rows,
    });
  } catch (err) {
    console.error('Bookings by status report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
