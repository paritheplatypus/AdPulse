const redis = require('../db/redis');
const { query } = require('../db');
const logger = require('../utils/logger');

const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS) || 3600;
const SESSION_KEY = (sessionId) => `session:${sessionId}:history`;
const LIVE_COUNTER_KEY = 'adpulse:live_viewers';

/**
 * Creates a new session in PostgreSQL and initializes Redis state.
 */
const createSession = async (userId) => {
  const result = await query(
    `INSERT INTO sessions (user_id) VALUES ($1) RETURNING *`,
    [userId]
  );
  const session = result.rows[0];

  // Initialize empty history in Redis
  await redis.set(SESSION_KEY(session.id), JSON.stringify([]), 'EX', SESSION_TTL);

  // Increment live viewer counter
  await redis.incr(LIVE_COUNTER_KEY);
  await redis.expire(LIVE_COUNTER_KEY, SESSION_TTL);

  logger.info('Session created', { sessionId: session.id, userId });
  return session;
};

/**
 * Retrieves session history from Redis (fast path) or
 * reconstructs from PostgreSQL if cache miss.
 */
const getSessionHistory = async (sessionId) => {
  const cached = await redis.get(SESSION_KEY(sessionId));
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss — reconstruct from DB
  logger.warn('Session cache miss, reconstructing from DB', { sessionId });
  const result = await query(
    `SELECT a.id, a.title, a.advertiser, a.category, a.duration_seconds, i.served_at
     FROM impressions i
     JOIN ads a ON a.id = i.ad_id
     WHERE i.session_id = $1
     ORDER BY i.position_in_session ASC`,
    [sessionId]
  );

  const history = result.rows;
  await redis.set(SESSION_KEY(sessionId), JSON.stringify(history), 'EX', SESSION_TTL);
  return history;
};

/**
 * Records an impression in both PostgreSQL (durable) and Redis (fast).
 */
const recordImpression = async (sessionId, ad, positionInSession) => {
  // Write to PostgreSQL
  await query(
    `INSERT INTO impressions (session_id, ad_id, position_in_session) VALUES ($1, $2, $3)`,
    [sessionId, ad.id, positionInSession]
  );

  // Update session last_active
  await query(
    `UPDATE sessions SET last_active_at = NOW() WHERE id = $1`,
    [sessionId]
  );

  // Append to Redis history
  const history = await getSessionHistory(sessionId);
  history.push({
    id: ad.id,
    title: ad.title,
    advertiser: ad.advertiser,
    category: ad.category,
    duration_seconds: ad.duration_seconds,
    served_at: new Date().toISOString(),
  });
  await redis.set(SESSION_KEY(sessionId), JSON.stringify(history), 'EX', SESSION_TTL);

  logger.debug('Impression recorded', { sessionId, adId: ad.id, position: positionInSession });
};

/**
 * Expires a session in both stores.
 */
const expireSession = async (sessionId) => {
  await query(`UPDATE sessions SET expired = true WHERE id = $1`, [sessionId]);
  await redis.del(SESSION_KEY(sessionId));
  await redis.decr(LIVE_COUNTER_KEY);
  logger.info('Session expired', { sessionId });
};

/**
 * Returns the count of live viewers from Redis.
 */
const getLiveViewerCount = async () => {
  const count = await redis.get(LIVE_COUNTER_KEY);
  return parseInt(count) || 0;
};

module.exports = {
  createSession,
  getSessionHistory,
  recordImpression,
  expireSession,
  getLiveViewerCount,
};
