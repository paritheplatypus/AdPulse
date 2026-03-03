require('dotenv').config();
const { query, pool } = require('./index');
const { createTables } = require('./migrate');
const logger = require('../utils/logger');

const ADS = [
  // Automotive
  { title: 'Drive the Future — Toyota EV', advertiser: 'Toyota', category: 'automotive', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.2 },
  { title: 'Ford F-150: Built Tough', advertiser: 'Ford', category: 'automotive', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.0 },
  { title: 'Tesla Model 3 — Zero Emissions', advertiser: 'Tesla', category: 'automotive', duration_seconds: 15, max_frequency_per_session: 2, weight: 1.1 },

  // Food & Beverage
  { title: "McDonald's — Billions Served", advertiser: "McDonald's", category: 'food_beverage', duration_seconds: 15, max_frequency_per_session: 3, weight: 1.3 },
  { title: 'Coca-Cola — Taste the Feeling', advertiser: 'Coca-Cola', category: 'food_beverage', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.0 },
  { title: 'DoorDash — Delivered Fast', advertiser: 'DoorDash', category: 'food_beverage', duration_seconds: 15, max_frequency_per_session: 3, weight: 1.1 },

  // Technology
  { title: 'Apple iPhone 16 — Hello, Intelligence', advertiser: 'Apple', category: 'technology', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.4 },
  { title: 'Samsung Galaxy — Do More', advertiser: 'Samsung', category: 'technology', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.2 },
  { title: 'Microsoft Copilot — Your AI Companion', advertiser: 'Microsoft', category: 'technology', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.0 },

  // Entertainment
  { title: 'Spotify — Music for Everyone', advertiser: 'Spotify', category: 'entertainment', duration_seconds: 15, max_frequency_per_session: 3, weight: 1.1 },
  { title: 'Amazon Prime — Shop. Watch. Enjoy.', advertiser: 'Amazon', category: 'entertainment', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.3 },

  // Finance
  { title: 'Chase Sapphire — Earn More Rewards', advertiser: 'Chase', category: 'finance', duration_seconds: 30, max_frequency_per_session: 2, weight: 0.9 },
  { title: 'Fidelity — Your Future, Invested', advertiser: 'Fidelity', category: 'finance', duration_seconds: 30, max_frequency_per_session: 1, weight: 0.8 },

  // Health & Wellness
  { title: 'Peloton — Find Your Push', advertiser: 'Peloton', category: 'health_wellness', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.0 },
  { title: 'Hims & Hers — Feel Like Yourself', advertiser: 'Hims & Hers', category: 'health_wellness', duration_seconds: 30, max_frequency_per_session: 2, weight: 0.9 },

  // Retail
  { title: 'Target — Expect More. Pay Less.', advertiser: 'Target', category: 'retail', duration_seconds: 15, max_frequency_per_session: 3, weight: 1.1 },
  { title: 'Nike — Just Do It', advertiser: 'Nike', category: 'retail', duration_seconds: 30, max_frequency_per_session: 2, weight: 1.2 },
];

const seed = async () => {
  try {
    logger.info('Starting database seed...');
    await createTables();

    // Clear existing data
    await query('DELETE FROM impressions');
    await query('DELETE FROM sessions');
    await query('DELETE FROM ads');

    // Insert ads
    for (const ad of ADS) {
      await query(
        `INSERT INTO ads (title, advertiser, category, duration_seconds, max_frequency_per_session, weight)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ad.title, ad.advertiser, ad.category, ad.duration_seconds, ad.max_frequency_per_session, ad.weight]
      );
    }

    // Seed some historical sessions and impressions for analytics
    const userIds = ['user_alice', 'user_bob', 'user_carol', 'user_dave', 'user_eve'];
    const adRows = (await query('SELECT id FROM ads')).rows;

    for (const userId of userIds) {
      const sessionResult = await query(
        `INSERT INTO sessions (user_id, started_at, last_active_at)
         VALUES ($1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '30 minutes')
         RETURNING id`,
        [userId]
      );
      const sessionId = sessionResult.rows[0].id;

      // Simulate 8-12 impressions per session
      const impressionCount = 8 + Math.floor(Math.random() * 5);
      let lastAdId = null;
      for (let i = 0; i < impressionCount; i++) {
        let ad;
        do {
          ad = adRows[Math.floor(Math.random() * adRows.length)];
        } while (ad.id === lastAdId);
        lastAdId = ad.id;

        await query(
          `INSERT INTO impressions (session_id, ad_id, served_at, position_in_session)
           VALUES ($1, $2, NOW() - INTERVAL '${(impressionCount - i) * 5} minutes', $3)`,
          [sessionId, ad.id, i + 1]
        );
      }
    }

    logger.info(`Seeded ${ADS.length} ads and ${userIds.length} historical sessions`);
    process.exit(0);
  } catch (err) {
    logger.error('Seed failed', { error: err.message });
    process.exit(1);
  }
};

seed();
