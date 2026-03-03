const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { selectNextAd } = require('../services/adSelection');
const {
  createSession,
  getSessionHistory,
  recordImpression,
  expireSession,
  getLiveViewerCount,
} = require('../services/sessionService');
const logger = require('../utils/logger');

// POST /sessions — start a new session
router.post(
  '/',
  [body('userId').trim().notEmpty().withMessage('userId is required')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const session = await createSession(req.body.userId);
      res.status(201).json({ sessionId: session.id, userId: session.user_id, startedAt: session.started_at });
    } catch (err) {
      next(err);
    }
  }
);

// GET /sessions/live-count — live viewer count from Redis
router.get('/live-count', async (req, res, next) => {
  try {
    const count = await getLiveViewerCount();
    res.json({ liveViewers: count });
  } catch (err) {
    next(err);
  }
});

// GET /sessions/:sessionId — get session + history
router.get('/:sessionId', async (req, res, next) => {
  try {
    const sessionResult = await db.query(
      `SELECT * FROM sessions WHERE id = $1`,
      [req.params.sessionId]
    );
    if (!sessionResult.rows.length) return res.status(404).json({ error: 'Session not found' });

    const history = await getSessionHistory(req.params.sessionId);
    res.json({ session: sessionResult.rows[0], history, impressionCount: history.length });
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:sessionId/next-ad — THE CORE ENDPOINT
// Given a session, select and serve the optimal next ad
router.post('/:sessionId/next-ad', async (req, res, next) => {
  const { sessionId } = req.params;

  try {
    // Verify session exists and is active
    const sessionResult = await db.query(
      `SELECT * FROM sessions WHERE id = $1 AND expired = false`,
      [sessionId]
    );
    if (!sessionResult.rows.length) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    // Fetch all active ads
    const adsResult = await db.query(
      `SELECT * FROM ads WHERE active = true`
    );
    const ads = adsResult.rows;

    // Get session history from Redis (fast path)
    const history = await getSessionHistory(sessionId);

    // Run selection algorithm
    const { selected, reason, candidateCount } = selectNextAd(ads, history);

    if (!selected) {
      return res.status(422).json({ error: 'No eligible ads available', reason });
    }

    // Record impression
    const positionInSession = history.length + 1;
    await recordImpression(sessionId, selected, positionInSession);

    logger.info('Ad served', {
      sessionId,
      adId: selected.id,
      advertiser: selected.advertiser,
      position: positionInSession,
      reason,
      candidateCount,
    });

    res.json({
      ad: {
        id: selected.id,
        title: selected.title,
        advertiser: selected.advertiser,
        category: selected.category,
        duration_seconds: selected.duration_seconds,
      },
      meta: {
        positionInSession,
        candidateCount,
        selectionReason: reason,
        servedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /sessions/:sessionId — expire a session
router.delete('/:sessionId', async (req, res, next) => {
  try {
    await expireSession(req.params.sessionId);
    res.json({ expired: true, sessionId: req.params.sessionId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
