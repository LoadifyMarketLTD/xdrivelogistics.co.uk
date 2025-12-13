/**
 * Feedback routes
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/feedback
 * List all feedback entries
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const result = await pool.query(
      'SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1',
      [Number(limit)]
    );

    return res.json({
      feedback: result.rows,
      count: result.rowCount,
    });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/:id
 * Get a single feedback entry
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM feedback WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching feedback:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/feedback
 * Submit feedback
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, booking_id, rating, comment } = req.body;

    // Validate rating is an integer between 1 and 5
    const ratingNum = Number(rating);
    if (!rating || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const insertQuery = `
      INSERT INTO feedback (user_id, booking_id, rating, comment, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      user_id || null,
      booking_id || null,
      ratingNum,
      comment || null,
    ]);

    return res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: result.rows[0],
    });
  } catch (err) {
    console.error('Error creating feedback:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
