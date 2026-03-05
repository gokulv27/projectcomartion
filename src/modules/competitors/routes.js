'use strict';
const express = require('express');
const db      = require('../../config/db');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();

// GET /api/v1/competitors
router.get('/', async (req, res, next) => {
  try {
    const { type, country, search, isActive, page = 1, perPage = 20 } = req.query;
    const conds = []; const params = []; let p = 1;
    if (type)    { conds.push(`c.competitor_type = $${p++}`);  params.push(type); }
    if (country) { conds.push(`co.code = $${p++}`);            params.push(country); }
    if (search)  { conds.push(`(c.name ILIKE $${p++} OR c.code ILIKE $${p++})`); params.push(`%${search}%`, `%${search}%`); p++; }
    if (isActive !== undefined) { conds.push(`c.is_active = $${p++}`); params.push(isActive === 'true'); }
    const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(perPage);
    const [rows, count] = await Promise.all([
      db.query(
        `SELECT c.id, c.code, c.name, c.logo_url, c.logo_color_hex, c.competitor_type,
                c.founded_year, c.website_url, c.is_active,
                co.name as hq_country_name, co.flag_emoji,
                COUNT(DISTINCT t.id)::int as terminal_count
         FROM competitors c
         LEFT JOIN countries co ON c.hq_country_id = co.id
         LEFT JOIN terminals t  ON t.competitor_id = c.id
         ${where} GROUP BY c.id, co.name, co.flag_emoji
         ORDER BY c.name LIMIT $${p} OFFSET $${p+1}`,
        [...params, perPage, offset]
      ),
      db.query(`SELECT COUNT(*) FROM competitors c LEFT JOIN countries co ON c.hq_country_id=co.id ${where}`, params),
    ]);
    res.json({ success: true, data: rows.rows, meta: { page: parseInt(page), perPage: parseInt(perPage), total: parseInt(count.rows[0].count) } });
  } catch (err) { next(err); }
});

// GET /api/v1/competitors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [comp, offers, vas, pricing, software] = await Promise.all([
      db.query(`SELECT c.*, co.name as hq_country, co.flag_emoji FROM competitors c LEFT JOIN countries co ON c.hq_country_id=co.id WHERE c.id=$1`, [req.params.id]),
      db.query(`SELECT co.*, ot.name as offer_type_name FROM competitor_offers co LEFT JOIN offer_types ot ON co.offer_type_id=ot.id WHERE co.competitor_id=$1`, [req.params.id]),
      db.query(`SELECT cv.*, vt.name as vas_name, vt.category FROM competitor_vas cv JOIN vas_types vt ON cv.vas_type_id=vt.id WHERE cv.competitor_id=$1`, [req.params.id]),
      db.query(`SELECT cp.*, ps.name as structure_name FROM competitor_pricing cp JOIN pricing_structures ps ON cp.pricing_structure_id=ps.id WHERE cp.competitor_id=$1`, [req.params.id]),
      db.query(`SELECT * FROM competitor_software WHERE competitor_id=$1`, [req.params.id]),
    ]);
    if (!comp.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Competitor not found' } });
    res.json({ success: true, data: { ...comp.rows[0], offers: offers.rows, vas: vas.rows, pricing: pricing.rows, software: software.rows[0] || null } });
  } catch (err) { next(err); }
});

// POST /api/v1/competitors
router.post('/', requireRole('manager'), async (req, res, next) => {
  try {
    const { code, name, logoUrl, logoColorHex, competitorType, hqCountryId, foundedYear, websiteUrl, description } = req.body;
    if (!code || !name || !competitorType) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'code, name, competitorType required' } });
    const result = await db.query(
      `INSERT INTO competitors (code, name, logo_url, logo_color_hex, competitor_type, hq_country_id, founded_year, website_url, description, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [code.toUpperCase(), name, logoUrl, logoColorHex, competitorType, hqCountryId, foundedYear, websiteUrl, description, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/v1/competitors/:id
router.put('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { code, name, logoUrl, logoColorHex, competitorType, hqCountryId, foundedYear, websiteUrl, description } = req.body;
    const result = await db.query(
      `UPDATE competitors SET code=$1,name=$2,logo_url=$3,logo_color_hex=$4,competitor_type=$5,hq_country_id=$6,founded_year=$7,website_url=$8,description=$9,updated_at=now()
       WHERE id=$10 RETURNING *`,
      [code, name, logoUrl, logoColorHex, competitorType, hqCountryId, foundedYear, websiteUrl, description, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Competitor not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/competitors/:id (soft)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await db.query('UPDATE competitors SET is_active=false, updated_at=now() WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { message: 'Competitor deactivated' } });
  } catch (err) { next(err); }
});

module.exports = router;
