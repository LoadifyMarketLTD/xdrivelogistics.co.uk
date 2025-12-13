/**
 * Invoices routes
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/invoices
 * List all invoices
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return res.json({
      invoices: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/invoices/:id
 * Get single invoice
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/invoices
 * Create new invoice
 */
router.post('/', async (req, res) => {
  try {
    const {
      booking_id,
      invoice_number,
      amount,
      due_date,
      status = 'pending',
      notes,
    } = req.body;

    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO invoices (booking_id, invoice_number, amount, due_date, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [booking_id, invoice_number, amount, due_date, status, notes]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/invoices/:id
 * Update invoice
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, due_date, status, notes } = req.body;

    const result = await pool.query(
      `UPDATE invoices SET
        amount = COALESCE($1, amount),
        due_date = COALESCE($2, due_date),
        status = COALESCE($3, status),
        notes = COALESCE($4, notes),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *`,
      [amount, due_date, status, notes, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
