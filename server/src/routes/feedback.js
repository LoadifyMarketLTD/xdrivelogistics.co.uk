/**
 * Feedback routes
 * - GET /api/feedback - List all feedback
 * - GET /api/feedback/:id - Get single feedback
 * - POST /api/feedback - Create new feedback
 */
import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/feedback
 * List all feedback entries
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, booking_id, limit = 50 } = req.query;

    let query = 'SELECT * FROM feedback WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (user_id) {
      query += ` AND user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (booking_id) {
      query += ` AND booking_id = $${paramCount}`;
      params.push(booking_id);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return res.json({
      feedback: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('Get feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/:id
 * Get single feedback by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM feedback WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Get feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/feedback
 * Create new feedback entry
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, booking_id, rating, comment } = req.body;

    // Validation
    if (!user_id || !rating) {
      return res.status(400).json({ error: 'Missing required fields (user_id, rating)' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const result = await pool.query(
      `INSERT INTO feedback (user_id, booking_id, rating, comment, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [user_id, booking_id, rating, comment]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
