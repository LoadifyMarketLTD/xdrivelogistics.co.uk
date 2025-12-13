/**
 * Feedback routes
 * - GET /api/feedback - List feedback
 * - POST /api/feedback - Submit feedback
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/feedback
 * List all feedback (optionally filtered by user_id or booking_id)
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, booking_id, limit = 50 } = req.query;

    let query = 'SELECT * FROM feedback WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (user_id) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (booking_id) {
      query += ` AND booking_id = $${paramIndex}`;
      params.push(booking_id);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramIndex}`;
    params.push(Math.min(Number(limit), 200));

    const result = await pool.query(query, params);

    return res.json({
      feedback: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('List feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/feedback
 * Submit new feedback
 */
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      booking_id,
      rating,
      comment,
      feedback_type,
    } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ error: 'rating and comment required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const insertQuery = `
      INSERT INTO feedback (
        user_id, booking_id, rating, comment, feedback_type, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      user_id || null,
      booking_id || null,
      rating,
      comment,
      feedback_type || 'general',
    ]);

    return res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: result.rows[0],
    });
  } catch (err) {
    console.error('Submit feedback error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
