/**
 * Reports routes - gross margin and other analytics
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/reports/gross-margin?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calculate gross margin and subcontract spend for bookings in date range
 */
router.get('/gross-margin', async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_bookings,
        SUM(price) as total_revenue,
        SUM(subcontract_cost) as total_subcontract_cost,
        SUM(price - COALESCE(subcontract_cost, 0)) as gross_margin_total,
        AVG(price - COALESCE(subcontract_cost, 0)) as avg_gross_margin
      FROM bookings
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (from) {
      query += ` AND pickup_window_start >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND pickup_window_start <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    const data = result.rows[0];

    // Calculate percentages
    const grossMarginPercentage = data.total_revenue > 0 
      ? ((data.gross_margin_total / data.total_revenue) * 100).toFixed(2)
      : 0;

    return res.json({
      period: {
        from: from || 'all time',
        to: to || 'all time',
      },
      summary: {
        total_bookings: parseInt(data.total_bookings) || 0,
        total_revenue: parseFloat(data.total_revenue) || 0,
        total_subcontract_cost: parseFloat(data.total_subcontract_cost) || 0,
        gross_margin_total: parseFloat(data.gross_margin_total) || 0,
        avg_gross_margin: parseFloat(data.avg_gross_margin) || 0,
        gross_margin_percentage: parseFloat(grossMarginPercentage),
      },
    });
  } catch (error) {
    console.error('Error calculating gross margin:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/bookings-by-status
 * Get count of bookings grouped by status
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
  } catch (error) {
    console.error('Error fetching bookings by status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/revenue-by-month
 * Get revenue grouped by month
 */
router.get('/revenue-by-month', async (req, res) => {
  try {
    const { year } = req.query;
    
    let query = `
      SELECT 
        TO_CHAR(pickup_window_start, 'YYYY-MM') as month,
        COUNT(*) as bookings,
        SUM(price) as revenue,
        SUM(subcontract_cost) as costs,
        SUM(price - COALESCE(subcontract_cost, 0)) as margin
      FROM bookings
      WHERE 1=1
    `;
    
    const params = [];
    if (year) {
      query += ` AND EXTRACT(YEAR FROM pickup_window_start) = $1`;
      params.push(year);
    }
    
    query += ` GROUP BY TO_CHAR(pickup_window_start, 'YYYY-MM')
               ORDER BY month DESC
               LIMIT 12`;

    const result = await pool.query(query, params);

    return res.json({
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching revenue by month:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
