/**
 * Bookings routes
 * - GET /api/bookings - List all bookings
 * - GET /api/bookings/:id - Get single booking
 * - POST /api/bookings - Create new booking
 * - PUT /api/bookings/:id - Update booking
 * - DELETE /api/bookings/:id - Delete booking
 */
import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/bookings
 * List all bookings with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { status, from_date, to_date, limit = 100 } = req.query;

    // Explicitly select columns to avoid exposing sensitive data
    let query = `SELECT id, load_id, from_location, to_location, vehicle_type, 
                        pickup_date, delivery_date, price, subcontract_cost, 
                        status, completed_by, created_at, updated_at 
                 FROM bookings WHERE 1=1`;
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
      query += ` AND delivery_date <= $${paramCount}`;
      params.push(to_date);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return res.json({
      bookings: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('Get bookings error:', err);
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

    const result = await pool.query(
      `SELECT id, load_id, from_location, to_location, vehicle_type, 
              pickup_date, delivery_date, price, subcontract_cost, 
              status, completed_by, created_at, updated_at 
       FROM bookings WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json(result.rows[0]);
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
      from_location,
      to_location,
      vehicle_type,
      pickup_date,
      delivery_date,
      price,
      subcontract_cost,
      status = 'pending',
      completed_by,
    } = req.body;

    // Validation
    if (!from_location || !to_location || !pickup_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO bookings (
        load_id, from_location, to_location, vehicle_type,
        pickup_date, delivery_date, price, subcontract_cost,
        status, completed_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        load_id,
        from_location,
        to_location,
        vehicle_type,
        pickup_date,
        delivery_date,
        price,
        subcontract_cost,
        status,
        completed_by,
      ]
    );

    return res.status(201).json(result.rows[0]);
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
      from_location,
      to_location,
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

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (from_location !== undefined) {
      updates.push(`from_location = $${paramCount++}`);
      params.push(from_location);
    }
    if (to_location !== undefined) {
      updates.push(`to_location = $${paramCount++}`);
      params.push(to_location);
    }
    if (vehicle_type !== undefined) {
      updates.push(`vehicle_type = $${paramCount++}`);
      params.push(vehicle_type);
    }
    if (pickup_date !== undefined) {
      updates.push(`pickup_date = $${paramCount++}`);
      params.push(pickup_date);
    }
    if (delivery_date !== undefined) {
      updates.push(`delivery_date = $${paramCount++}`);
      params.push(delivery_date);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      params.push(price);
    }
    if (subcontract_cost !== undefined) {
      updates.push(`subcontract_cost = $${paramCount++}`);
      params.push(subcontract_cost);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      params.push(status);
    }
    if (completed_by !== undefined) {
      updates.push(`completed_by = $${paramCount++}`);
      params.push(completed_by);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE bookings SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, params);

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Update booking error:', err);
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

    return res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    console.error('Delete booking error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
