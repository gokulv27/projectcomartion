'use strict';
const rateLimit = require('express-rate-limit');

const defaultLimiter = rateLimit({
  windowMs: 1000,
  max: 100000, // effectively disabled for testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' } },
});

const loginLimiter = rateLimit({
  windowMs: 1000,
  max: 100000, // effectively disabled for testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Account locked for 15 minutes.' } },
});

module.exports = { defaultLimiter, loginLimiter };
