/**
 * Feedback routes
 */
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/feedback
 * List all feedback
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      'SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return res.json({
      feedback: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/:id
 * Get single feedback
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM feedback WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/feedback
 * Submit new feedback
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, booking_id, rating, comment } = req.body;

    if (!rating) {
      return res.status(400).json({ error: 'Rating is required' });
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
  } catch (error) {
    console.error('Error creating feedback:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
