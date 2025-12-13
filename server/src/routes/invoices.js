/**
 * Invoices routes
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/invoices
 * Get all invoices
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM invoices';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    res.json({
      invoices: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/invoices/:id
 * Get a single invoice by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post('/', async (req, res) => {
  try {
    const { booking_id, amount, status, due_date, notes } = req.body;

    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'Booking ID and amount are required' });
    }

    const result = await pool.query(
      `INSERT INTO invoices (booking_id, amount, status, due_date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [booking_id, amount, status || 'pending', due_date, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/invoices/:id
 * Update an invoice
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status, due_date, paid_date, notes } = req.body;

    const result = await pool.query(
      `UPDATE invoices SET
        amount = COALESCE($1, amount),
        status = COALESCE($2, status),
        due_date = COALESCE($3, due_date),
        paid_date = COALESCE($4, paid_date),
        notes = COALESCE($5, notes),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *`,
      [amount, status, due_date, paid_date, notes, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
