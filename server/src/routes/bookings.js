/**
 * Bookings routes
 * - GET /api/bookings - List all bookings
 * - GET /api/bookings/:id - Get single booking
 * - POST /api/bookings - Create booking
 * - PUT /api/bookings/:id - Update booking
 * - DELETE /api/bookings/:id - Delete booking
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/bookings
 * List all bookings with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { status, from_date, to_date, limit = 100 } = req.query;

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (from_date) {
      query += ` AND pickup_date >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      query += ` AND pickup_date <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    query += ' ORDER BY pickup_date DESC, created_at DESC';
    query += ` LIMIT $${paramIndex}`;
    params.push(Math.min(Number(limit), 500));

    const result = await pool.query(query, params);

    return res.json({
      bookings: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('List bookings error:', err);
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

    return res.json({ booking: result.rows[0] });
  } catch (err) {
    console.error('Get booking error:', err);
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
      pickup_date,
      delivery_date,
      status,
      price,
      subcontract_cost,
      completed_by,
    } = req.body;

    // Basic validation
    if (!from_address || !to_address || !vehicle_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const insertQuery = `
      INSERT INTO bookings (
        load_id, from_address, to_address, vehicle_type,
        pickup_date, delivery_date, status, price, subcontract_cost,
        completed_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      load_id || null,
      from_address,
      to_address,
      vehicle_type,
      pickup_date || null,
      delivery_date || null,
      status || 'pending',
      price || 0,
      subcontract_cost || 0,
      completed_by || null,
    ]);

    return res.status(201).json({
      message: 'Booking created successfully',
      booking: result.rows[0],
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/bookings/:id
 * Update existing booking
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      load_id,
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
      status,
      price,
      subcontract_cost,
      completed_by,
    } = req.body;

    // Check if booking exists
    const existing = await pool.query('SELECT id FROM bookings WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const updateQuery = `
      UPDATE bookings
      SET
        load_id = COALESCE($1, load_id),
        from_address = COALESCE($2, from_address),
        to_address = COALESCE($3, to_address),
        vehicle_type = COALESCE($4, vehicle_type),
        pickup_date = COALESCE($5, pickup_date),
        delivery_date = COALESCE($6, delivery_date),
        status = COALESCE($7, status),
        price = COALESCE($8, price),
        subcontract_cost = COALESCE($9, subcontract_cost),
        completed_by = COALESCE($10, completed_by),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      load_id,
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
      status,
      price,
      subcontract_cost,
      completed_by,
      id,
    ]);

    return res.json({
      message: 'Booking updated successfully',
      booking: result.rows[0],
    });
  } catch (err) {
    console.error('Update booking error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/bookings/:id
 * Delete booking (soft delete by setting status to 'cancelled')
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      ['cancelled', id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('Delete booking error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
