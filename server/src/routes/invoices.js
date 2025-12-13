/**
 * Invoices routes
 * - GET /api/invoices - List all invoices
 * - GET /api/invoices/:id - Get single invoice
 * - POST /api/invoices - Create new invoice
 * - PUT /api/invoices/:id - Update invoice
 */
import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/invoices
 * List all invoices
 */
router.get('/', async (req, res) => {
  try {
    const { booking_id, status, limit = 100 } = req.query;

    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (booking_id) {
      query += ` AND booking_id = $${paramCount}`;
      params.push(booking_id);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return res.json({
      invoices: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/invoices/:id
 * Get single invoice by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Get invoice error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/invoices
 * Create new invoice
 */
router.post('/', async (req, res) => {
  try {
    const { booking_id, invoice_number, amount, due_date, status = 'pending' } = req.body;

    // Validation
    if (!booking_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO invoices (booking_id, invoice_number, amount, due_date, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [booking_id, invoice_number, amount, due_date, status]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create invoice error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/invoices/:id
 * Update existing invoice
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, due_date, status, paid_at } = req.body;

    // Check if invoice exists
    const existing = await pool.query('SELECT id FROM invoices WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (amount !== undefined) {
      updates.push(`amount = $${paramCount++}`);
      params.push(amount);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      params.push(due_date);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      params.push(status);
    }
    if (paid_at !== undefined) {
      updates.push(`paid_at = $${paramCount++}`);
      params.push(paid_at);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, params);

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Update invoice error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
