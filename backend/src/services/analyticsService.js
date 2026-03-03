const { query } = require('../db');
const redis = require('../db/redis');
const { computeDiversityScore } = require('./adSelection');

const ANALYTICS_CACHE_KEY = 'adpulse:analytics:summary';
const ANALYTICS_CACHE_TTL = 30; // seconds

const getSummary = async () => {
  // Try cache first
  const cached = await redis.get(ANALYTICS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const [totalImpressions, topContent, categoryBreakdown, recentSessions, repetitionRate] =
    await Promise.all([
      getTotalImpressions(),
      getTopAds(10),
      getCategoryBreakdown(),
      getRecentSessionDiversityScores(),
      getRepetitionRate(),
    ]);

  const summary = {
    totalImpressions,
    topContent,
    categoryBreakdown,
    recentSessions,
    repetitionRate,
    computedAt: new Date().toISOString(),
  };

  await redis.set(ANALYTICS_CACHE_KEY, JSON.stringify(summary), 'EX', ANALYTICS_CACHE_TTL);
  return summary;
};

const getTotalImpressions = async () => {
  const result = await query(`SELECT COUNT(*) as count FROM impressions`);
  return parseInt(result.rows[0].count);
};

const getTopAds = async (limit = 10) => {
  const result = await query(
    `SELECT
       a.id,
       a.title,
       a.advertiser,
       a.category,
       a.duration_seconds,
       COUNT(i.id) as impression_count,
       COUNT(DISTINCT i.session_id) as unique_sessions
     FROM ads a
     LEFT JOIN impressions i ON i.ad_id = a.id
     GROUP BY a.id
     ORDER BY impression_count DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

const getCategoryBreakdown = async () => {
  const result = await query(
    `SELECT
       a.category,
       COUNT(i.id) as impression_count,
       ROUND(COUNT(i.id) * 100.0 / NULLIF(SUM(COUNT(i.id)) OVER (), 0), 1) as percentage
     FROM ads a
     LEFT JOIN impressions i ON i.ad_id = a.id
     GROUP BY a.category
     ORDER BY impression_count DESC`
  );
  return result.rows;
};

const getRecentSessionDiversityScores = async () => {
  const sessionsResult = await query(
    `SELECT id, user_id, started_at
     FROM sessions
     WHERE expired = false
     ORDER BY last_active_at DESC
     LIMIT 20`
  );

  const scores = await Promise.all(
    sessionsResult.rows.map(async (session) => {
      const historyResult = await query(
        `SELECT a.id, a.advertiser, a.category
         FROM impressions i
         JOIN ads a ON a.id = i.ad_id
         WHERE i.session_id = $1
         ORDER BY i.position_in_session ASC`,
        [session.id]
      );
      const diversityScore = computeDiversityScore(historyResult.rows);
      return {
        sessionId: session.id,
        userId: session.user_id,
        startedAt: session.started_at,
        impressionCount: historyResult.rows.length,
        diversityScore: Math.round(diversityScore * 100) / 100,
      };
    })
  );

  return scores;
};

const getRepetitionRate = async () => {
  // Percentage of consecutive impressions where the same ad was shown back-to-back
  const result = await query(
    `WITH ordered AS (
       SELECT
         session_id,
         ad_id,
         LAG(ad_id) OVER (PARTITION BY session_id ORDER BY position_in_session) as prev_ad_id
       FROM impressions
     )
     SELECT
       COUNT(*) FILTER (WHERE ad_id = prev_ad_id) as repeats,
       COUNT(*) FILTER (WHERE prev_ad_id IS NOT NULL) as total_consecutive
     FROM ordered`
  );

  const { repeats, total_consecutive } = result.rows[0];
  if (total_consecutive === 0) return 0;
  return Math.round((repeats / total_consecutive) * 100 * 10) / 10;
};

const getImpressionsTimeSeries = async (hours = 24) => {
  const result = await query(
    `SELECT
       DATE_TRUNC('hour', served_at) as hour,
       COUNT(*) as impression_count
     FROM impressions
     WHERE served_at > NOW() - INTERVAL '${hours} hours'
     GROUP BY hour
     ORDER BY hour ASC`
  );
  return result.rows;
};

module.exports = { getSummary, getTopAds, getCategoryBreakdown, getImpressionsTimeSeries };
