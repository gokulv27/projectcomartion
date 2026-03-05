'use strict';
const express = require('express');
const db = require('../../config/db');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();

const ALLOWED_TABLES = [
  'offer_types',
  'vas_types',
  'pricing_structures',
  'payment_interfaces',
  'software_ecosystems',
  'countries',
  'verticals'
];

// Helper to validate table name
const validateTable = (req, res, next) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TABLE', message: 'Table not found or not allowed' } });
  }
  next();
};

// GET /api/v1/master/:table
router.get('/:table', requireRole('viewer'), validateTable, async (req, res, next) => {
  try {
    const { table } = req.params;
    let query = `SELECT * FROM ${table}`;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/v1/master/:table/:id
router.get('/:table/:id', requireRole('viewer'), validateTable, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    const result = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/v1/master/:table
router.post('/:table', requireRole('admin'), validateTable, async (req, res, next) => {
  try {
    const { table } = req.params;
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    
    if (keys.length === 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Empty body' } });
    
    // Construct columns and placeholders
    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
    const result = await db.query(query, values);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/v1/master/:table/:id
router.put('/:table/:id', requireRole('admin'), validateTable, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    
    if (keys.length === 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Empty body' } });
    
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    values.push(id); // for the WHERE id = $<last>
    
    const query = `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING *`;
    const result = await db.query(query, values);
    
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/v1/master/:table/:id
router.delete('/:table/:id', requireRole('admin'), validateTable, async (req, res, next) => {
  try {
    const { table, id } = req.params;
    await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    res.json({ success: true, data: { message: 'Record deleted' } });
  } catch (err) { next(err); }
});

module.exports = router;
