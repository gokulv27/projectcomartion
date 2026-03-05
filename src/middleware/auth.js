'use strict';
const jwt    = require('jsonwebtoken');
const jwtCfg = require('../config/jwt');
const db     = require('../config/db');

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtCfg.publicKey, { algorithms: [jwtCfg.algorithm] });
    // Attach user to request
    const result = await db.query('SELECT id, email, username, role, is_active FROM users WHERE id = $1', [payload.sub]);
    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found or deactivated' } });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}

module.exports = { authenticate };
