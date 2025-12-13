/**
 * Bookings routes
 * - GET /api/bookings - List all bookings
 * - GET /api/bookings/:id - Get single booking
 * - POST /api/bookings - Create booking
 * - PUT /api/bookings/:id - Update booking
 * - DELETE /api/bookings/:id - Delete booking
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

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
    console.error('List bookings error:', err);
    console.error('Error fetching bookings:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/bookings/:id
 * Get single booking by ID
 * Get a single booking by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const result = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return res.json({ booking: result.rows[0] });
  } catch (err) {
    console.error('Get booking error:', err);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching booking:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/bookings
 * Create new booking
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
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
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
    } = req.body;

    // Basic validation
    if (!from_address || !to_address || !vehicle_type) {
      return res.status(400).json({ error: 'Missing required fields' });
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
        pickup_date, delivery_date, status, price, subcontract_cost,
        completed_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        pickup_date, delivery_date, price, subcontract_cost,
        status, completed_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      load_id || null,
      load_id,
      from_address,
      to_address,
      vehicle_type,
      pickup_date || null,
      delivery_date || null,
      status || 'pending',
      price || 0,
      subcontract_cost || 0,
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
    console.error('Create booking error:', err);
    console.error('Error creating booking:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/bookings/:id
 * Update existing booking
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
      load_id,
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
      status,
      price,
      subcontract_cost,
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
        updated_at = NOW()
      WHERE id = $11
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
      load_id,
      from_address,
      to_address,
      vehicle_type,
      pickup_date,
      delivery_date,
      status,
      price,
      subcontract_cost,
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
    console.error('Update booking error:', err);
    console.error('Error updating booking:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/bookings/:id
 * Delete booking (soft delete by setting status to 'cancelled')
 * Delete a booking
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING id', [id]);
    const result = await pool.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      ['cancelled', id]
      'DELETE FROM bookings WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ message: 'Booking deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('Delete booking error:', err);
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
