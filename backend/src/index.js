require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createTables } = require('./db/migrate');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'adpulse-backend', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

const start = async () => {
  try {
    await createTables();
    logger.info('Database schema ready');

    app.listen(PORT, () => {
      logger.info(`AdPulse backend running on port ${PORT}`, { env: process.env.NODE_ENV });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
};

start();

module.exports = app;
