const { query } = require('./index');
const logger = require('../utils/logger');

const createTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS ads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      advertiser VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
      max_frequency_per_session INTEGER NOT NULL DEFAULT 3 CHECK (max_frequency_per_session > 0),
      weight FLOAT NOT NULL DEFAULT 1.0 CHECK (weight > 0),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expired BOOLEAN NOT NULL DEFAULT false
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS impressions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
      served_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      position_in_session INTEGER NOT NULL
    )
  `);

  // Indexes for performance
  await query(`CREATE INDEX IF NOT EXISTS idx_impressions_session_id ON impressions(session_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_impressions_ad_id ON impressions(ad_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_impressions_served_at ON impressions(served_at)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at)`);

  logger.info('Database schema initialized successfully');
};

module.exports = { createTables };
