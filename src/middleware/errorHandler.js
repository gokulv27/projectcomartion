'use strict';
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'A record with this value already exists.' } });
  }
  if (err.code === '23503') { // Foreign key violation
    return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE', message: 'Related record not found.' } });
  }

  const status  = err.status || err.statusCode || 500;
  const code    = err.code || 'INTERNAL_SERVER_ERROR';
  const message = process.env.NODE_ENV === 'production' && status === 500 ? 'An unexpected error occurred' : err.message;

  res.status(status).json({ success: false, error: { code, message } });
}

module.exports = { errorHandler };
