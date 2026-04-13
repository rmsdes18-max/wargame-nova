const { Router } = require('express');
const { pool }   = require('../db');
const router     = Router();

const SUPER_ADMIN_DISCORD_ID = process.env.SUPER_ADMIN_DISCORD_ID;

// Import verifyToken
let _verifyToken = null;
function getVerifyToken() {
  if (!_verifyToken) _verifyToken = require('./auth').verifyToken;
  return _verifyToken;
}

// Middleware: check super admin — returns 404 (not 403) to hide existence
async function checkSuperAdmin(req, res, next) {
  if (!SUPER_ADMIN_DISCORD_ID) return res.status(404).json({ error: 'Not found' });

  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  const user = getVerifyToken()(token);

  if (!user || !user.discord_id || user.discord_id !== SUPER_ADMIN_DISCORD_ID) {
    return res.status(404).json({ error: 'Not found' });
  }

  req.user = user;
  next();
}

// GET /api/sudo/stats
router.get('/stats', checkSuperAdmin, async (req, res) => {
  try {
    const [guilds, users, wars, warsMonth] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as count FROM guilds'),
      pool.query('SELECT COUNT(*)::int as count FROM users'),
      pool.query('SELECT COUNT(*)::int as count FROM wars'),
      pool.query("SELECT COUNT(*)::int as count FROM wars WHERE created_at >= date_trunc('month', now())"),
    ]);
    res.json({
      totalGuilds: guilds.rows[0].count,
      totalUsers: users.rows[0].count,
      totalWars: wars.rows[0].count,
      warsThisMonth: warsMonth.rows[0].count,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sudo/guilds
router.get('/guilds', checkSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.id, g.name, g.slug, g.tier, g.created_at, g.invite_code,
             u.username as owner_username,
             (SELECT COUNT(*)::int FROM guild_members WHERE guild_id = g.id) as member_count,
             (SELECT COUNT(*)::int FROM wars WHERE guild_id = g.id) as wars_count
      FROM guilds g
      LEFT JOIN users u ON u.id = g.owner_id
      ORDER BY g.created_at DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sudo/users
router.get('/users', checkSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.discord_id, u.avatar, u.created_at,
             (SELECT COUNT(*)::int FROM guild_members WHERE user_id = u.id) as guilds_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
    // Mask discord IDs
    res.json(rows.map(u => ({
      ...u,
      discord_id: u.discord_id ? u.discord_id.slice(0, 4) + '...' + u.discord_id.slice(-4) : null,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sudo/guilds/:id/tier
router.patch('/guilds/:id/tier', checkSuperAdmin, async (req, res) => {
  const { tier } = req.body;
  if (!tier || !['free', 'pro'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be "free" or "pro"' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE guilds SET tier = $1 WHERE id = $2 RETURNING id, name, tier',
      [tier, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Guild not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sudo/guilds/:id
router.delete('/guilds/:id', checkSuperAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM guilds WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Guild not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sudo/users/:id
router.delete('/users/:id', checkSuperAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sudo/health
router.get('/health', checkSuperAdmin, async (req, res) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (e) {}
  res.json({
    database: dbOk ? 'ok' : 'error',
    anthropic_key: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
  });
});

module.exports = router;
