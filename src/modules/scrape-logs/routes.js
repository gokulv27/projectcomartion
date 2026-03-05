const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../../utils/logger');
const { requireRole: authorize } = require('../../middleware/rbac');

/**
 * GET /api/v1/scrape-logs
 * List all scrape logs with filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const { competitorId, status, page = 1, perPage = 20 } = req.query;
    const offset = (page - 1) * perPage;

    let query = `
      SELECT l.*, c.name as competitor_name, c.logo_color_hex
      FROM scrape_logs l
      JOIN competitors c ON l.competitor_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (competitorId) {
      params.push(competitorId);
      query += ` AND l.competitor_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND l.status = $${params.length}`;
    }

    // Count total for pagination
    const countQuery = query.replace('l.*, c.name as competitor_name, c.logo_color_hex', 'COUNT(*) as total');
    const totalResult = await db.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].total);

    // Limit/Offset
    params.push(perPage, offset);
    query += ` ORDER BY l.scraped_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      meta: { total, page: parseInt(page), perPage: parseInt(perPage) }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/scrape-logs/:id
 * Get single log detail
 */
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT l.*, c.name as competitor_name
      FROM scrape_logs l
      JOIN competitors c ON l.competitor_id = c.id
      WHERE l.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Scrape log not found' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/scrape-logs/trigger/:competitorId
 * Manually trigger a scrape for a competitor
 * Restricted to manager/admin
 */
router.post('/trigger/:competitorId', authorize('manager'), async (req, res, next) => {
  try {
    const compId = req.params.competitorId;
    
    // Check if competitor exists
    const compCheck = await db.query('SELECT id, name FROM competitors WHERE id = $1', [compId]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Competitor not found' } });
    }

    // Trigger Python script asynchronously
    const scraperPath = path.join(__dirname, '../../../../scrapers/scraper.py');
    const pythonPath = 'python3'; // or path to venv

    logger.info(`Manually triggering scrape for ${compCheck.rows[0].name} (ID: ${compId})`);

    const process = spawn(pythonPath, [scraperPath, compId]);

    process.stdout.on('data', (data) => {
      logger.info(`Scraper STDOUT: ${data}`);
    });

    process.stderr.on('data', (data) => {
      logger.error(`Scraper STDERR: ${data}`);
    });

    process.on('close', (code) => {
      logger.info(`Scraper process exited with code ${code}`);
    });

    res.status(202).json({
      success: true,
      message: 'Scrape triggered successfully. It will run in the background.'
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
