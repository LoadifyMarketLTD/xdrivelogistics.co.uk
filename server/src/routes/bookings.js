/**
 * Bookings routes: CRUD operations for bookings/loads
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/bookings
 * Get all bookings (with optional filters)
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM bookings';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    res.json({
      bookings: result.rows,
      total: result.rowCount,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/bookings/:id
 * Get a single booking by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/bookings
 * Create a new booking
 */
router.post('/', async (req, res) => {
  try {
    const {
      load_id,
      customer_name,
      from_address,
      to_address,
      vehicle_type,
      pickup_time,
      delivery_time,
      status,
      price,
      subcontract_cost,
      completed_by,
      your_ref,
      notes
    } = req.body;

    // Validation
    if (!from_address || !to_address) {
      return res.status(400).json({ error: 'From and to addresses are required' });
    }

    const result = await pool.query(
      `INSERT INTO bookings (
        load_id, customer_name, from_address, to_address, vehicle_type,
        pickup_time, delivery_time, status, price, subcontract_cost,
        completed_by, your_ref, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        load_id,
        customer_name,
        from_address,
        to_address,
        vehicle_type,
        pickup_time,
        delivery_time,
        status || 'pending',
        price,
        subcontract_cost,
        completed_by,
        your_ref,
        notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/bookings/:id
 * Update a booking
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      from_address,
      to_address,
      vehicle_type,
      pickup_time,
      delivery_time,
      status,
      price,
      subcontract_cost,
      completed_by,
      your_ref,
      notes
    } = req.body;

    const result = await pool.query(
      `UPDATE bookings SET
        customer_name = COALESCE($1, customer_name),
        from_address = COALESCE($2, from_address),
        to_address = COALESCE($3, to_address),
        vehicle_type = COALESCE($4, vehicle_type),
        pickup_time = COALESCE($5, pickup_time),
        delivery_time = COALESCE($6, delivery_time),
        status = COALESCE($7, status),
        price = COALESCE($8, price),
        subcontract_cost = COALESCE($9, subcontract_cost),
        completed_by = COALESCE($10, completed_by),
        your_ref = COALESCE($11, your_ref),
        notes = COALESCE($12, notes),
        updated_at = NOW()
      WHERE id = $13
      RETURNING *`,
      [
        customer_name,
        from_address,
        to_address,
        vehicle_type,
        pickup_time,
        delivery_time,
        status,
        price,
        subcontract_cost,
        completed_by,
        your_ref,
        notes,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/bookings/:id
 * Delete a booking
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ message: 'Booking deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
