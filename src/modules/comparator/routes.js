'use strict';
const express = require('express');
const db      = require('../../config/db');

const router = express.Router();

// GET /api/v1/comparator/matrix — full matrix for ALL competitors
router.get('/matrix', async (req, res, next) => {
  try {
    const [competitors, vas] = await Promise.all([
      db.query('SELECT id, name, logo_color_hex, competitor_type FROM competitors WHERE is_active = true ORDER BY name'),
      db.query(
        `SELECT vt.code as vas_code, vt.name as vas_name, vt.category,
                cv.competitor_id, cv.is_available
         FROM vas_types vt
         LEFT JOIN competitor_vas cv ON vt.id = cv.vas_type_id
         ORDER BY vt.name`
      ),
    ]);

    // Build vas map: { [vas_code]: { vasName, vasCategory, [comp_id]: isAvailable } }
    const vasMap = {};
    vas.rows.forEach(r => {
      if (!vasMap[r.vas_code]) vasMap[r.vas_code] = { vasName: r.vas_name, vasCategory: r.category };
      if (r.competitor_id) vasMap[r.vas_code][r.competitor_id] = r.is_available;
    });

    res.json({ success: true, data: { competitors: competitors.rows, vas: vasMap } });
  } catch (err) { next(err); }
});

// GET /api/v1/comparator
router.get('/', async (req, res, next) => {
  try {
    let ids = req.query['competitors[]'] || req.query.competitors;
    if (!ids) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'competitors[] query param required' } });
    if (!Array.isArray(ids)) ids = [ids];
    ids = ids.slice(0, 5);

    const { category, country } = req.query;

    const [competitors, hardware, software, vas, pricing, offers] = await Promise.all([
      db.query('SELECT id, name, logo_url, logo_color_hex FROM competitors WHERE id = ANY($1)', [ids]),
      db.query(
        `SELECT t.*, tc.name as category_name, tc.code as category_code,
                array_agg(pi.name) FILTER (WHERE pi.id IS NOT NULL) as payment_interfaces
         FROM terminals t
         JOIN terminal_categories tc ON t.category_id = tc.id
         LEFT JOIN terminal_payment_interfaces tpi ON t.id = tpi.terminal_id
         LEFT JOIN payment_interfaces pi ON tpi.payment_interface_id = pi.id
         WHERE t.competitor_id = ANY($1) ${category ? 'AND tc.code = $2' : ''}
         GROUP BY t.id, tc.name, tc.code`,
        category ? [ids, category] : [ids]
      ),
      db.query('SELECT * FROM competitor_software WHERE competitor_id = ANY($1)', [ids]),
      db.query(
        `SELECT vt.code as vas_code, vt.name, vt.category,
                cv.competitor_id, cv.is_available, cv.provider_name
         FROM vas_types vt
         LEFT JOIN competitor_vas cv ON vt.id = cv.vas_type_id AND cv.competitor_id = ANY($1)
         ORDER BY vt.category, vt.name`,
        [ids]
      ),
      db.query(
        `SELECT cp.*, ps.name as structure_name
         FROM competitor_pricing cp
         JOIN pricing_structures ps ON cp.pricing_structure_id = ps.id
         WHERE cp.competitor_id = ANY($1)`,
        [ids]
      ),
      db.query(
        `SELECT co.*, ot.name as offer_type_name FROM competitor_offers co
         LEFT JOIN offer_types ot ON co.offer_type_id = ot.id
         WHERE co.competitor_id = ANY($1)`,
        [ids]
      ),
    ]);

    // Build dimension maps
    const hwMap = {};
    hardware.rows.forEach(r => { if (!hwMap[r.competitor_id]) hwMap[r.competitor_id] = []; hwMap[r.competitor_id].push(r); });
    const swMap = {};
    software.rows.forEach(r => { swMap[r.competitor_id] = r; });
    const vasMap = {};
    vas.rows.forEach(r => {
      if (!vasMap[r.vas_code]) vasMap[r.vas_code] = { vasName: r.name, vasCategory: r.category };
      if (r.competitor_id) vasMap[r.vas_code][r.competitor_id] = { isAvailable: r.is_available, providerName: r.provider_name };
    });
    const priceMap = {};
    pricing.rows.forEach(r => { if (!priceMap[r.competitor_id]) priceMap[r.competitor_id] = []; priceMap[r.competitor_id].push(r); });
    const offerMap = {};
    offers.rows.forEach(r => { offerMap[r.competitor_id] = r; });

    res.json({
      success: true,
      data: {
        competitors: competitors.rows,
        hardware: hwMap, software: swMap, vas: vasMap, pricing: priceMap, offers: offerMap,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
