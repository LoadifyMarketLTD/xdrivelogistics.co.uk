/**
 * Invoices routes
 * - GET /api/invoices - List invoices
 * - GET /api/invoices/:id - Get single invoice
 * - POST /api/invoices - Create invoice
 * - PUT /api/invoices/:id - Update invoice
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
    const { status, booking_id, limit = 100 } = req.query;

    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (booking_id) {
      query += ` AND booking_id = $${paramIndex}`;
      params.push(booking_id);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramIndex}`;
    params.push(Math.min(Number(limit), 500));
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
    console.error('List invoices error:', err);
    console.error('Error fetching invoices:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/invoices/:id
 * Get single invoice by ID
 * Get a single invoice
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    const result = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.json({ invoice: result.rows[0] });
  } catch (err) {
    console.error('Get invoice error:', err);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching invoice:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/invoices
 * Create new invoice
 * Create a new invoice
 */
router.post('/', async (req, res) => {
  try {
    const {
      booking_id,
      invoice_number,
      amount,
      status,
      due_date,
      notes,
    } = req.body;

    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'booking_id and amount required' });
    }

    const insertQuery = `
      INSERT INTO invoices (
        booking_id, invoice_number, amount, status, due_date, notes,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
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
      invoice_number || `INV-${Date.now()}`,
      amount,
      status || 'pending',
      due_date || null,
      notes || null,
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
    console.error('Create invoice error:', err);
    console.error('Error creating invoice:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/invoices/:id
 * Update existing invoice
 * Update an invoice
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status, due_date, notes, paid_date } = req.body;

    const existing = await pool.query('SELECT id FROM invoices WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const updateQuery = `
      UPDATE invoices
      SET
        amount = COALESCE($1, amount),
        status = COALESCE($2, status),
        due_date = COALESCE($3, due_date),
        notes = COALESCE($4, notes),
        paid_date = COALESCE($5, paid_date),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      amount,
      status,
      due_date,
      notes,
      paid_date,
      id,
    ]);

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
    console.error('Update invoice error:', err);
    console.error('Error updating invoice:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
