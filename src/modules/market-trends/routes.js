'use strict';
const express = require('express');
const db      = require('../../config/db');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { type, country, competitor, impact, page = 1, perPage = 20 } = req.query;
    const conds = []; const params = []; let p = 1;
    if (type)       { conds.push(`m.trend_type = $${p++}`);              params.push(type); }
    if (country)    { conds.push(`co.code = $${p++}`);                   params.push(country); }
    if (competitor) { conds.push(`m.competitor_id = $${p++}`);           params.push(competitor); }
    if (impact)     { conds.push(`m.impact_rating = $${p++}`);           params.push(impact); }
    const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(perPage);
    const rows = await db.query(
      `SELECT m.*, c.name as competitor_name, c.logo_color_hex, co.name as country_name, co.flag_emoji
       FROM market_trends m
       LEFT JOIN competitors c ON m.competitor_id = c.id
       LEFT JOIN countries co ON m.country_id = co.id
       ${where} ORDER BY m.trend_date DESC LIMIT $${p} OFFSET $${p+1}`,
      [...params, perPage, offset]
    );
    res.json({ success: true, data: rows.rows });
  } catch (err) { next(err); }
});

router.post('/', requireRole('analyst'), async (req, res, next) => {
  try {
    const { competitorId, countryId, trendType, title, description, sourceUrl, trendDate, impactRating, tags } = req.body;
    const result = await db.query(
      `INSERT INTO market_trends (competitor_id, country_id, trend_type, title, description, source_url, trend_date, impact_rating, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [competitorId, countryId, trendType, title, description, sourceUrl, trendDate, impactRating, tags, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id', requireRole('analyst'), async (req, res, next) => {
  try {
    const { competitorId, countryId, trendType, title, description, sourceUrl, trendDate, impactRating, tags } = req.body;
    const result = await db.query(
      `UPDATE market_trends SET competitor_id=$1,country_id=$2,trend_type=$3,title=$4,description=$5,source_url=$6,trend_date=$7,impact_rating=$8,tags=$9
       WHERE id=$10 RETURNING *`,
      [competitorId, countryId, trendType, title, description, sourceUrl, trendDate, impactRating, tags, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trend not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM market_trends WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { message: 'Trend deleted' } });
  } catch (err) { next(err); }
});

module.exports = router;
