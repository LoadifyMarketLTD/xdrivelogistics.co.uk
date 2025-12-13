/**
 * Bookings CRUD routes
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/bookings
 * List all bookings (with optional filtering)
 */
router.get('/', async (req, res) => {
  try {
    const { status, from_date, to_date, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (from_date) {
      query += ` AND pickup_window_start >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      query += ` AND pickup_window_end <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return res.json({
      bookings: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/bookings/:id
 * Get single booking by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching booking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/bookings
 * Create new booking
 */
router.post('/', async (req, res) => {
  try {
    const {
      load_id,
      from_address,
      to_address,
      vehicle_type,
      pickup_window_start,
      pickup_window_end,
      delivery_instruction,
      subcontractor,
      price,
      subcontract_cost,
      status = 'Pending',
      completed_by,
    } = req.body;

    // Basic validation
    if (!from_address || !to_address || !vehicle_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO bookings (
        load_id, from_address, to_address, vehicle_type,
        pickup_window_start, pickup_window_end, delivery_instruction,
        subcontractor, price, subcontract_cost, status, completed_by,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        load_id,
        from_address,
        to_address,
        vehicle_type,
        pickup_window_start,
        pickup_window_end,
        delivery_instruction,
        subcontractor,
        price,
        subcontract_cost,
        status,
        completed_by,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/bookings/:id
 * Update booking
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      from_address,
      to_address,
      vehicle_type,
      pickup_window_start,
      pickup_window_end,
      delivery_instruction,
      subcontractor,
      price,
      subcontract_cost,
      status,
      completed_by,
    } = req.body;

    // Check if booking exists
    const existing = await pool.query('SELECT id FROM bookings WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const result = await pool.query(
      `UPDATE bookings SET
        from_address = COALESCE($1, from_address),
        to_address = COALESCE($2, to_address),
        vehicle_type = COALESCE($3, vehicle_type),
        pickup_window_start = COALESCE($4, pickup_window_start),
        pickup_window_end = COALESCE($5, pickup_window_end),
        delivery_instruction = COALESCE($6, delivery_instruction),
        subcontractor = COALESCE($7, subcontractor),
        price = COALESCE($8, price),
        subcontract_cost = COALESCE($9, subcontract_cost),
        status = COALESCE($10, status),
        completed_by = COALESCE($11, completed_by),
        updated_at = NOW()
      WHERE id = $12
      RETURNING *`,
      [
        from_address,
        to_address,
        vehicle_type,
        pickup_window_start,
        pickup_window_end,
        delivery_instruction,
        subcontractor,
        price,
        subcontract_cost,
        status,
        completed_by,
        id,
      ]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating booking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/bookings/:id
 * Delete booking
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({ message: 'Booking deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
