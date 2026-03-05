'use strict';
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const logger         = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { defaultLimiter } = require('./middleware/rateLimiter');
const { authenticate } = require('./middleware/auth');

// Route modules
const authRoutes             = require('./modules/auth/routes');
const usersRoutes            = require('./modules/users/routes');
const terminalCategoriesRoutes = require('./modules/terminal-categories/routes');
const competitorsRoutes      = require('./modules/competitors/routes');
const comparatorRoutes       = require('./modules/comparator/routes');
const marketTrendsRoutes     = require('./modules/market-trends/routes');
const gapAnalysisRoutes      = require('./modules/gap-analysis/routes');
const scrapeLogsRoutes       = require('./modules/scrape-logs/routes');
const masterDataRoutes       = require('./modules/master-data/routes');

const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.http(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`, { userId: req.user?.id });
  });
  next();
});

// Rate limiter
app.use('/api', defaultLimiter);

// Public routes
app.use('/api/v1/auth', authRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Protected routes
app.use('/api/v1/users',              authenticate, usersRoutes);
app.use('/api/v1/terminal-categories', authenticate, terminalCategoriesRoutes);
app.use('/api/v1/competitors',        authenticate, competitorsRoutes);
app.use('/api/v1/comparator',         authenticate, comparatorRoutes);
app.use('/api/v1/market-trends',      authenticate, marketTrendsRoutes);
app.use('/api/v1/gap-analysis',       authenticate, gapAnalysisRoutes);
app.use('/api/v1/scrape-logs',        authenticate, scrapeLogsRoutes);
app.use('/api/v1/master',             authenticate, masterDataRoutes);

// 404
app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }));

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Terminal Comparator API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
