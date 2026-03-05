'use strict';
const express      = require('express');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db           = require('../../config/db');
const jwtCfg       = require('../../config/jwt');
const { loginLimiter } = require('../../middleware/rateLimiter');
const logger       = require('../../utils/logger');

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
    }

    const result = await db.query(
      'SELECT id, email, username, password_hash, role, first_name, last_name, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];
    const valid = user && user.is_active && await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }

    // Update last_login
    await db.query('UPDATE users SET last_login = now() WHERE id = $1', [user.id]);

    // Issue access token
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, jti: uuidv4() },
      jwtCfg.privateKey,
      { algorithm: jwtCfg.algorithm, expiresIn: jwtCfg.accessTokenExpiry }
    );

    // Issue refresh token
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [user.id, tokenHash, expiresAt, req.headers['user-agent'], req.ip]
    );

    res.cookie('refresh_token', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      expires: expiresAt,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, username: user.username, role: user.role, firstName: user.first_name, lastName: user.last_name },
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refresh_token;
    if (!rawToken) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No refresh token' } });

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const result = await db.query(
      `SELECT us.*, u.id as uid, u.role, u.is_active, u.email, u.username, u.first_name, u.last_name
       FROM user_sessions us JOIN users u ON us.user_id = u.id
       WHERE us.token_hash = $1 AND us.expires_at > now()`,
      [tokenHash]
    );

    const session = result.rows[0];
    if (!session || !session.is_active) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } });
    }

    // Rotate token
    await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
    const newRaw = crypto.randomBytes(48).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [session.uid, newHash, expiresAt]);

    const accessToken = jwt.sign(
      { sub: session.uid, role: session.role, jti: uuidv4() },
      jwtCfg.privateKey,
      { algorithm: jwtCfg.algorithm, expiresIn: jwtCfg.accessTokenExpiry }
    );

    res.cookie('refresh_token', newRaw, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict', expires: expiresAt });
    res.json({ success: true, data: { accessToken } });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refresh_token;
    if (rawToken) {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
    }
    res.clearCookie('refresh_token');
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) { next(err); }
});

module.exports = router;
