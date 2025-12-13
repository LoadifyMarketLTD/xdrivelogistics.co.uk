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
 * List all feedback
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      'SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
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
  } catch (error) {
    console.error('Error fetching feedback:', error);
  } catch (err) {
    console.error('List feedback error:', err);
    console.error('Error fetching feedback:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback/:id
 * Get single feedback
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
 * GET /api/feedback/:id
 * Get a single feedback entry
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM feedback WHERE id = $1', [id]);
    const result = await pool.query(
      'SELECT * FROM feedback WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching feedback:', error);
  } catch (err) {
    console.error('Error fetching feedback:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/feedback
 * Submit new feedback
 * Submit feedback
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
      rating,
      comment,
      feedback_type || 'general',
      ratingNum,
      comment || null,
    ]);

    return res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback: result.rows[0],
    });
  } catch (err) {
    console.error('Submit feedback error:', err);
    console.error('Error creating feedback:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
