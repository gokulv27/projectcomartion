'use strict';
const express = require('express');
const db      = require('../../config/db');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { competitor, country, priority, status, page = 1, perPage = 20 } = req.query;
    const conds = []; const params = []; let p = 1;
    if (competitor) { conds.push(`g.competitor_id = $${p++}`); params.push(competitor); }
    if (country)    { conds.push(`g.country_id = $${p++}`);    params.push(country); }
    if (priority)   { conds.push(`g.priority = $${p++}`);      params.push(priority); }
    if (status)     { conds.push(`g.status = $${p++}`);        params.push(status); }
    const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(perPage);
    const rows = await db.query(
      `SELECT g.*, c.name as competitor_name, co.name as country_name
       FROM gap_analysis g
       LEFT JOIN competitors c ON g.competitor_id = c.id
       LEFT JOIN countries co ON g.country_id = co.id
       ${where} ORDER BY g.created_at DESC LIMIT $${p} OFFSET $${p+1}`,
      [...params, perPage, offset]
    );
    res.json({ success: true, data: rows.rows });
  } catch (err) { next(err); }
});

router.post('/', requireRole('analyst'), async (req, res, next) => {
  try {
    const { competitorId, countryId, gapType, title, description, priority, owner, targetQuarter } = req.body;
    const result = await db.query(
      `INSERT INTO gap_analysis (competitor_id, country_id, gap_type, title, description, priority, owner, target_quarter, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [competitorId, countryId, gapType, title, description, priority, owner, targetQuarter, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id', requireRole('analyst'), async (req, res, next) => {
  try {
    const { competitorId, countryId, gapType, title, description, priority, owner, targetQuarter } = req.body;
    const result = await db.query(
      `UPDATE gap_analysis SET competitor_id=$1,country_id=$2,gap_type=$3,title=$4,description=$5,priority=$6,owner=$7,target_quarter=$8,updated_at=now()
       WHERE id=$9 RETURNING *`,
      [competitorId, countryId, gapType, title, description, priority, owner, targetQuarter, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Gap analysis entry not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.patch('/:id/status', requireRole('manager'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await db.query('UPDATE gap_analysis SET status=$1,updated_at=now() WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Gap analysis entry not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM gap_analysis WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { message: 'Gap analysis deleted' } });
  } catch (err) { next(err); }
});

module.exports = router;
