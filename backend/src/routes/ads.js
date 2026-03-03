const router = require('express').Router();
const { body, query: queryValidator, validationResult } = require('express-validator');
const db = require('../db');
const redis = require('../db/redis');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /ads — list all ads with impression stats
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         a.*,
         COUNT(i.id) as total_impressions,
         COUNT(DISTINCT i.session_id) as unique_sessions
       FROM ads a
       LEFT JOIN impressions i ON i.ad_id = a.id
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    );
    res.json({ ads: result.rows, count: result.rows.length });
  } catch (err) {
    next(err);
  }
});

// GET /ads/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*, COUNT(i.id) as total_impressions
       FROM ads a
       LEFT JOIN impressions i ON i.ad_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ad not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /ads — create a new ad (protected)
router.post(
  '/',
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('advertiser').trim().notEmpty().withMessage('Advertiser is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('duration_seconds').isInt({ min: 1, max: 300 }).withMessage('Duration must be 1-300 seconds'),
    body('max_frequency_per_session').isInt({ min: 1, max: 10 }).withMessage('Max frequency must be 1-10'),
    body('weight').optional().isFloat({ min: 0.1, max: 10 }).withMessage('Weight must be 0.1-10'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { title, advertiser, category, duration_seconds, max_frequency_per_session, weight = 1.0 } = req.body;
      const result = await db.query(
        `INSERT INTO ads (title, advertiser, category, duration_seconds, max_frequency_per_session, weight)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [title, advertiser, category, duration_seconds, max_frequency_per_session, weight]
      );

      // Invalidate analytics cache
      await redis.del('adpulse:analytics:summary');

      logger.info('Ad created', { adId: result.rows[0].id, advertiser });
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /ads/:id — update ad (protected)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { active, max_frequency_per_session, weight } = req.body;
    const result = await db.query(
      `UPDATE ads SET
         active = COALESCE($1, active),
         max_frequency_per_session = COALESCE($2, max_frequency_per_session),
         weight = COALESCE($3, weight),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [active, max_frequency_per_session, weight, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ad not found' });
    await redis.del('adpulse:analytics:summary');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /ads/:id (protected)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM ads WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ad not found' });
    await redis.del('adpulse:analytics:summary');
    res.json({ deleted: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
