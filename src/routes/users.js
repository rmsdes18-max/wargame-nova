const { Router } = require('express');
const { pool }   = require('../db');
const crypto     = require('crypto');
const router     = Router();

function generateSecret() {
  return crypto.randomBytes(4).toString('hex'); // 8 char hex
}

// Middleware: require admin role from X-Admin-Secret header
async function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret) return res.status(401).json({ error: 'Secret required' });
  try {
    // Check env-level admin secret first
    if (secret === process.env.ADMIN_SECRET) {
      req.user = { username: 'admin', role: 'admin' };
      return next();
    }
    // Check users table
    const { rows } = await pool.query('SELECT username, role FROM users WHERE secret = $1', [secret]);
    if (!rows.length || rows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = rows[0];
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// POST /api/auth — verify secret, return user info
router.post('/auth', async (req, res) => {
  const { secret } = req.body;
  if (!secret) return res.status(400).json({ error: 'Secret required' });
  try {
    // Check env-level admin secret
    if (secret === process.env.ADMIN_SECRET) {
      return res.json({ username: 'admin', role: 'admin' });
    }
    // Check users table
    const { rows } = await pool.query('SELECT username, role FROM users WHERE secret = $1', [secret]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid secret' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users — admin only, list all users
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, secret, role, created_at FROM users ORDER BY created_at'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users — admin only, create user
router.post('/', requireAdmin, async (req, res) => {
  const { username, role } = req.body;
  if (!username || !role) return res.status(400).json({ error: 'username and role required' });
  if (!['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const secret = generateSecret();
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, secret, role) VALUES ($1, $2, $3) RETURNING id, username, secret, role, created_at',
      [username, secret, role]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/:id — admin only, update role
router.patch('/:id', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!role || !['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Valid role required' });
  try {
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, secret, role',
      [role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
