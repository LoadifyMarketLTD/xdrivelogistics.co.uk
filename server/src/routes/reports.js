/**
 * Reports routes - gross margin and other analytics
 */
const express = require('express');
const pool = require('../db');
 * Reports routes: analytics and aggregated data
 */
const express = require('express');
const pool = require('../db');
 * Reports routes
 * - GET /api/reports/gross-margin - Calculate gross margin and subcontract spend
 */
import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/reports/gross-margin?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Calculate gross margin and subcontract spend for bookings in date range
 * Calculate gross margin and subcontract spend from bookings
 * Calculate gross margin total and subcontract spend from bookings
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
        COALESCE(SUM(price), 0) as total_revenue,
        COALESCE(SUM(subcontract_cost), 0) as subcontract_spend,
        COALESCE(SUM(price) - SUM(subcontract_cost), 0) as gross_margin
      FROM bookings
      WHERE 1=1
    `;
    const params = [];

    if (from) {
      params.push(from);
      query += ` AND created_at >= $${params.length}::date`;
    }

    if (to) {
      params.push(to);
      query += ` AND created_at <= $${params.length}::date`;
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
    res.json({
      period: {
        from: from || null,
        to: to || null,
      },
      total_bookings: parseInt(data.total_bookings),
      total_revenue: parseFloat(data.total_revenue || 0),
      subcontract_spend: parseFloat(data.subcontract_spend || 0),
      gross_margin: parseFloat(data.gross_margin || 0),
      gross_margin_percentage: data.total_revenue > 0 
        ? ((data.gross_margin / data.total_revenue) * 100).toFixed(2)
        : 0,
    });
  } catch (error) {
    console.error('Gross margin report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/dashboard-stats
 * Get dashboard statistics
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM bookings) as total_jobs,
        (SELECT COUNT(DISTINCT customer_name) FROM bookings WHERE customer_name IS NOT NULL) as total_customers,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM invoices WHERE status = 'pending') as invoices_due,
        (SELECT COUNT(*) FROM invoices WHERE status = 'awaiting_payment') as invoices_awaiting
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/monthly-totals?year=YYYY&month=MM
 * Get monthly totals for bookings
 */
router.get('/monthly-totals', async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || (currentDate.getMonth() + 1);

    const result = await pool.query(`
      SELECT
        COUNT(*) as bookings_received,
        COUNT(*) FILTER (WHERE status = 'subcontracted') as bookings_subcontracted,
        COUNT(*) FILTER (WHERE status = 'allocated' OR status = 'completed') as loads_allocated,
        0 as return_journeys
      FROM bookings
      WHERE EXTRACT(YEAR FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
    `, [targetYear, targetMonth]);

    res.json({
      year: parseInt(targetYear),
      month: parseInt(targetMonth),
      ...result.rows[0],
      bookings_received: parseInt(result.rows[0].bookings_received),
      bookings_subcontracted: parseInt(result.rows[0].bookings_subcontracted),
      loads_allocated: parseInt(result.rows[0].loads_allocated),
      return_journeys: 0,
    });
  } catch (error) {
    console.error('Monthly totals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
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

module.exports = router;
export default router;
