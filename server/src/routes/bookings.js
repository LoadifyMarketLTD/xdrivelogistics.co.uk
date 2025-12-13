/**
 * Bookings routes: CRUD operations for bookings/loads
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
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (from_date) {
      query += ` AND pickup_date >= $${paramCount}`;
      params.push(from_date);
      paramCount++;
    }

    if (to_date) {
      query += ` AND pickup_date <= $${paramCount}`;
      params.push(to_date);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(Number(limit));

    const result = await pool.query(query, params);

    return res.json({
      bookings: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/bookings/:id
 * Get a single booking by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching booking:', err);
    return res.status(500).json({ error: 'Internal server error' });
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
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
      price,
      subcontract_cost,
      status,
      completed_by,
    } = req.body;

    // Validation - be specific about missing fields
    const missingFields = [];
    if (!load_id) missingFields.push('load_id');
    if (!from_address) missingFields.push('from_address');
    if (!to_address) missingFields.push('to_address');
    if (!vehicle_type) missingFields.push('vehicle_type');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        missing: missingFields
      });
    }

    const insertQuery = `
      INSERT INTO bookings (
        load_id, from_address, to_address, vehicle_type,
        pickup_date, delivery_date, price, subcontract_cost,
        status, completed_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      load_id,
      from_address,
      to_address,
      vehicle_type,
      pickup_date || null,
      delivery_date || null,
      price || null,
      subcontract_cost || null,
      status || 'pending',
      completed_by || null,
    ]);

    return res.status(201).json({
      message: 'Booking created successfully',
      booking: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    return res.status(500).json({ error: 'Internal server error' });
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
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
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

    const updateQuery = `
      UPDATE bookings
      SET 
        from_address = COALESCE($1, from_address),
        to_address = COALESCE($2, to_address),
        vehicle_type = COALESCE($3, vehicle_type),
        pickup_date = COALESCE($4, pickup_date),
        delivery_date = COALESCE($5, delivery_date),
        price = COALESCE($6, price),
        subcontract_cost = COALESCE($7, subcontract_cost),
        status = COALESCE($8, status),
        completed_by = COALESCE($9, completed_by),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
      price,
      subcontract_cost,
      status,
      completed_by,
      id,
    ]);

    return res.json({
      message: 'Booking updated successfully',
      booking: result.rows[0],
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/bookings/:id
 * Delete a booking
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({
      message: 'Booking deleted successfully',
      id: result.rows[0].id,
    });
  } catch (err) {
    console.error('Error deleting booking:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
