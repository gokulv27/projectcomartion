'use strict';
const express  = require('express');
const bcrypt   = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db       = require('../../config/db');
const { requireRole } = require('../../middleware/rbac');

const router = express.Router();

// GET /api/v1/users
router.get('/', requireRole('manager'), async (req, res, next) => {
  try {
    const { role, isActive, search, page = 1, perPage = 20 } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;

    if (role)     { conditions.push(`role = $${p++}`);              params.push(role); }
    if (isActive !== undefined) { conditions.push(`is_active = $${p++}`); params.push(isActive === 'true'); }
    if (search)   { conditions.push(`(email ILIKE $${p++} OR username ILIKE $${p++} OR first_name ILIKE $${p++})`); params.push(`%${search}%`, `%${search}%`, `%${search}%`); p += 2; }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(perPage);

    const [rows, count] = await Promise.all([
      db.query(`SELECT id, email, username, role, first_name, last_name, is_active, created_at, last_login FROM users ${where} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p+1}`, [...params, perPage, offset]),
      db.query(`SELECT COUNT(*) FROM users ${where}`, params),
    ]);

    res.json({ success: true, data: rows.rows, meta: { page: parseInt(page), perPage: parseInt(perPage), total: parseInt(count.rows[0].count) } });
  } catch (err) { next(err); }
});

// GET /api/v1/users/:id
router.get('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, email, username, role, first_name, last_name, is_active, created_at, last_login FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/v1/users
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { email, username, password, role = 'viewer', firstName, lastName } = req.body;
    if (!email || !username || !password) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'email, username, password required' } });
    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const result = await db.query(
      'INSERT INTO users (email, username, password_hash, role, first_name, last_name, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, username, role, first_name, last_name, is_active, created_at',
      [email.toLowerCase(), username, hash, role, firstName, lastName, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/v1/users/:id
router.put('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const { firstName, lastName, email } = req.body;
    const result = await db.query(
      'UPDATE users SET first_name=$1, last_name=$2, email=$3, updated_at=now() WHERE id=$4 RETURNING id, email, username, role, first_name, last_name, is_active',
      [firstName, lastName, email, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/users/:id/role
router.patch('/:id/role', requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    const valid = ['viewer', 'analyst', 'manager', 'admin'];
    if (!valid.includes(role)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } });
    const result = await db.query('UPDATE users SET role=$1, updated_at=now() WHERE id=$2 RETURNING id, role', [role, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/v1/users/:id/deactivate
router.patch('/:id/deactivate', requireRole('admin'), async (req, res, next) => {
  try {
    await db.query('UPDATE users SET is_active=false, updated_at=now() WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { message: 'User deactivated' } });
  } catch (err) { next(err); }
});

// DELETE /api/v1/users/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(422).json({ success: false, error: { code: 'UNPROCESSABLE', message: 'Cannot delete your own account' } });
    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: { message: 'User deleted' } });
  } catch (err) { next(err); }
});

module.exports = router;
