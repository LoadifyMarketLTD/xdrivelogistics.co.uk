/**
 * Reports routes: gross margin and other analytics
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/reports/gross-margin?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calculate gross margin and subcontract spend from bookings
 */
router.get('/gross-margin', async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT 
        COUNT(*) as booking_count,
        SUM(price) as total_revenue,
        SUM(subcontract_cost) as subcontract_spend,
        SUM(price - COALESCE(subcontract_cost, 0)) as gross_margin_total
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
      query += ` AND pickup_date <= $${paramCount}`;
      params.push(to);
      paramCount++;
    }

    const result = await pool.query(query, params);
    const data = result.rows[0];

    // Calculate gross margin percentage
    const revenue = parseFloat(data.total_revenue || 0);
    const grossMargin = parseFloat(data.gross_margin_total || 0);
    const grossMarginPercentage = revenue > 0 ? ((grossMargin / revenue) * 100).toFixed(2) : 0;

    return res.json({
      period: {
        from: from || 'all',
        to: to || 'all',
      },
      metrics: {
        booking_count: parseInt(data.booking_count || 0),
        total_revenue: parseFloat(data.total_revenue || 0),
        subcontract_spend: parseFloat(data.subcontract_spend || 0),
        gross_margin_total: grossMargin,
        gross_margin_percentage: parseFloat(grossMarginPercentage),
      },
    });
  } catch (err) {
    console.error('Error calculating gross margin:', err);
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
      data: result.rows,
    });
  } catch (err) {
    console.error('Error fetching bookings by status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/revenue-by-month
 * Get monthly revenue breakdown
 */
router.get('/revenue-by-month', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(pickup_date, 'YYYY-MM') as month,
        COUNT(*) as booking_count,
        SUM(price) as total_revenue,
        SUM(subcontract_cost) as subcontract_spend,
        SUM(price - COALESCE(subcontract_cost, 0)) as gross_margin
      FROM bookings
      WHERE status = 'delivered' AND pickup_date IS NOT NULL
      GROUP BY TO_CHAR(pickup_date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `);

    return res.json({
      data: result.rows,
    });
  } catch (err) {
    console.error('Error fetching revenue by month:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
