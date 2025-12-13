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
    const { status, limit = 100 } = req.query;

    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(Number(limit));

    const result = await pool.query(query, params);

    return res.json({
      invoices: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('Error fetching invoices:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/invoices/:id
 * Get a single invoice
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching invoice:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post('/', async (req, res) => {
  try {
    const {
      booking_id,
      invoice_number,
      amount,
      due_date,
      status,
    } = req.body;

    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields: booking_id, amount' });
    }

    const insertQuery = `
      INSERT INTO invoices (booking_id, invoice_number, amount, due_date, status, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      booking_id,
      invoice_number || null,
      amount,
      due_date || null,
      status || 'pending',
    ]);

    return res.status(201).json({
      message: 'Invoice created successfully',
      invoice: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating invoice:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/invoices/:id
 * Update an invoice
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, amount, due_date } = req.body;

    const result = await pool.query(
      `UPDATE invoices
       SET status = COALESCE($1, status),
           amount = COALESCE($2, amount),
           due_date = COALESCE($3, due_date),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, amount, due_date, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.json({
      message: 'Invoice updated successfully',
      invoice: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating invoice:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
