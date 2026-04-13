const { pool } = require('../db');

// Resolve user from X-Admin-Secret header
async function resolveUser(req) {
  const secret = req.headers['x-admin-secret'];
  if (!secret) return null;
  // Check env admin secret
  if (secret === process.env.ADMIN_SECRET) return { username: 'admin', role: 'admin' };
  // Check users table
  try {
    const { rows } = await pool.query('SELECT username, role FROM users WHERE secret = $1', [secret]);
    return rows.length ? rows[0] : null;
  } catch (e) { return null; }
}

// Require admin role
async function requireAdmin(req, res, next) {
  const envSecret = process.env.ADMIN_SECRET;
  if (!envSecret) return next(); // dev mode
  const user = await resolveUser(req);
  if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Admin access required' });
  req.user = user;
  next();
}

// Require editor or admin role
async function requireEditor(req, res, next) {
  const envSecret = process.env.ADMIN_SECRET;
  if (!envSecret) return next(); // dev mode
  const user = await resolveUser(req);
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) return res.status(401).json({ error: 'Editor access required' });
  req.user = user;
  next();
}

// Backwards compatible: default export is requireAdmin (existing routes use it)
module.exports = requireAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireEditor = requireEditor;
module.exports.resolveUser = resolveUser;
