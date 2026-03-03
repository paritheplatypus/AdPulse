const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'adpulse',
  user: process.env.POSTGRES_USER || 'adpulse_user',
  password: process.env.POSTGRES_PASSWORD || 'adpulse_secret',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { query: text, duration: `${duration}ms`, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Query error', { query: text, error: err.message });
    throw err;
  }
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
