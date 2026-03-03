const router = require('express').Router();
const { generateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// POST /auth/token — generate a JWT for demo/dev use
// In production this would integrate with OAuth/SSO
router.post(
  '/token',
  [body('userId').trim().notEmpty().withMessage('userId is required')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const token = generateToken(req.body.userId);
    res.json({ token, expiresIn: '24h' });
  }
);

module.exports = router;
