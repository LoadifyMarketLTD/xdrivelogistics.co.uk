/**
 * Reports routes
 * - GET /api/reports/gross-margin - Calculate gross margin from bookings
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/reports/gross-margin?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calculate gross margin and subcontract spend for date range
 */
router.get('/gross-margin', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ 
        error: 'from and to date parameters required (format: YYYY-MM-DD)' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
    }

    const query = `
      SELECT 
        COUNT(*) as total_bookings,
        SUM(price) as total_revenue,
        SUM(subcontract_cost) as subcontract_spend,
        SUM(price - subcontract_cost) as gross_margin_total,
        AVG(price - subcontract_cost) as avg_margin_per_booking,
        ROUND(
          CASE 
            WHEN SUM(price) > 0 
            THEN (SUM(price - subcontract_cost) / SUM(price)) * 100 
            ELSE 0 
          END, 
          2
        ) as margin_percentage
      FROM bookings
      WHERE 
        pickup_date >= $1 
        AND pickup_date <= $2
        AND status IN ('completed', 'delivered')
    `;

    const result = await pool.query(query, [from, to]);
    const data = result.rows[0];

    // Get booking breakdown by status
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(price) as revenue,
        SUM(subcontract_cost) as cost
      FROM bookings
      WHERE pickup_date >= $1 AND pickup_date <= $2
      GROUP BY status
      ORDER BY count DESC
    `;

    const statusResult = await pool.query(statusQuery, [from, to]);

    return res.json({
      period: {
        from,
        to,
      },
      summary: {
        total_bookings: Number(data.total_bookings) || 0,
        total_revenue: Number(data.total_revenue) || 0,
        subcontract_spend: Number(data.subcontract_spend) || 0,
        gross_margin_total: Number(data.gross_margin_total) || 0,
        avg_margin_per_booking: Number(data.avg_margin_per_booking) || 0,
        margin_percentage: Number(data.margin_percentage) || 0,
      },
      breakdown_by_status: statusResult.rows.map(row => ({
        status: row.status,
        count: Number(row.count),
        revenue: Number(row.revenue) || 0,
        cost: Number(row.cost) || 0,
      })),
    });
  } catch (err) {
    console.error('Gross margin report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/daily-summary
 * Get daily booking and revenue summary
 */
router.get('/daily-summary', async (req, res) => {
  try {
    const { from, to } = req.query;

    const query = `
      SELECT 
        DATE(pickup_date) as date,
        COUNT(*) as bookings,
        SUM(price) as revenue,
        SUM(subcontract_cost) as cost,
        SUM(price - subcontract_cost) as margin
      FROM bookings
      WHERE pickup_date >= $1 AND pickup_date <= $2
      GROUP BY DATE(pickup_date)
      ORDER BY date DESC
    `;

    const result = await pool.query(query, [from || '2000-01-01', to || '2099-12-31']);

    return res.json({
      daily_summary: result.rows.map(row => ({
        date: row.date,
        bookings: Number(row.bookings),
        revenue: Number(row.revenue) || 0,
        cost: Number(row.cost) || 0,
        margin: Number(row.margin) || 0,
      })),
    });
  } catch (err) {
    console.error('Daily summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
