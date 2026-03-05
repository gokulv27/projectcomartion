'use strict';
const express  = require('express');
const db       = require('../../config/db');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();

// GET /api/v1/terminal-categories
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, perPage = 20, search, channel, targetSize, isActive } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;
    if (search)     { conditions.push(`(name ILIKE $${p++} OR code ILIKE $${p++})`); params.push(`%${search}%`, `%${search}%`); p++; }
    if (channel)    { conditions.push(`channel = $${p++}`);             params.push(channel); }
    if (targetSize) { conditions.push(`target_merchant_size = $${p++}`); params.push(targetSize); }
    if (isActive !== undefined) { conditions.push(`is_active = $${p++}`); params.push(isActive === 'true'); }

    const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(perPage);

    const [rows, count] = await Promise.all([
      db.query(
        `SELECT tc.*, u.username as created_by_username,
                COUNT(t.id)::int as terminal_count
         FROM terminal_categories tc
         LEFT JOIN users u ON tc.created_by = u.id
         LEFT JOIN terminals t ON t.category_id = tc.id
         ${where}
         GROUP BY tc.id, u.username
         ORDER BY tc.sort_order, tc.name
         LIMIT $${p} OFFSET $${p+1}`,
        [...params, perPage, offset]
      ),
      db.query(`SELECT COUNT(*) FROM terminal_categories ${where}`, params),
    ]);

    res.json({ success: true, data: rows.rows, meta: { page: parseInt(page), perPage: parseInt(perPage), total: parseInt(count.rows[0].count) } });
  } catch (err) { next(err); }
});

// GET /api/v1/terminal-categories/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT tc.*, COUNT(t.id)::int as terminal_count
       FROM terminal_categories tc
       LEFT JOIN terminals t ON t.category_id = tc.id
       WHERE tc.id = $1 GROUP BY tc.id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/v1/terminal-categories
router.post('/', requireRole('manager'), async (req, res, next) => {
  try {
    const { code, name, description, targetMerchantSize = 'Both', channel = 'In-Store', sortOrder = 0 } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'code and name are required' } });
    const result = await db.query(
      `INSERT INTO terminal_categories (code, name, description, target_merchant_size, channel, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code.toUpperCase(), name, description, targetMerchantSize, channel, sortOrder, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/v1/terminal-categories/:id
router.put('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { code, name, description, targetMerchantSize, channel, sortOrder, isActive } = req.body;
    const result = await db.query(
      `UPDATE terminal_categories SET code=$1, name=$2, description=$3, target_merchant_size=$4, channel=$5, sort_order=$6, is_active=$7, updated_at=now()
       WHERE id=$8 RETURNING *`,
      [code, name, description, targetMerchantSize, channel, sortOrder, isActive ?? true, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/terminal-categories/:id
router.patch('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const allowed = { code: 'code', name: 'name', description: 'description', targetMerchantSize: 'target_merchant_size', channel: 'channel', sortOrder: 'sort_order', isActive: 'is_active' };
    const sets = [];
    const params = [];
    let p = 1;
    for (const [key, col] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) { sets.push(`${col} = $${p++}`); params.push(req.body[key]); }
    }
    if (!sets.length) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } });
    sets.push(`updated_at = now()`);
    params.push(req.params.id);
    const result = await db.query(`UPDATE terminal_categories SET ${sets.join(', ')} WHERE id=$${p} RETURNING *`, params);
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/terminal-categories/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const check = await db.query('SELECT COUNT(*) FROM terminals WHERE category_id=$1 AND is_active=true', [req.params.id]);
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE', message: 'Cannot delete: terminals reference this category' } });
    }
    await db.query('UPDATE terminal_categories SET is_active=false, updated_at=now() WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { message: 'Category deactivated' } });
  } catch (err) { next(err); }
});

module.exports = router;
