const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Verifies a JWT Bearer token on protected routes.
 * In production this would integrate with an identity provider.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('JWT verification failed', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Generates a JWT for a given userId (used by /auth/token in dev)
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '24h' }
  );
};

module.exports = { authenticate, generateToken };
