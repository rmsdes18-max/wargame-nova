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
      SELECT g.id, g.name, g.slug, g.tier, g.region, g.server, g.created_at, g.invite_code,
             u.username as owner_username,
             (SELECT COUNT(*)::int FROM roster_members WHERE guild_id = g.id AND active = true) as member_count,
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
             COALESCE(
               (SELECT string_agg(g.name || ' (' || gm.role || ')', ', ')
                FROM guild_members gm JOIN guilds g ON g.id = gm.guild_id
                WHERE gm.user_id = u.id), ''
             ) as guilds_info,
             (SELECT COUNT(*)::int FROM guild_members WHERE user_id = u.id) as guilds_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
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

// GET /api/sudo/debug — full DB state for debugging
router.get('/debug', checkSuperAdmin, async (req, res) => {
  try {
    const [users, members, guilds] = await Promise.all([
      pool.query('SELECT id, username, discord_id, role as user_role, created_at FROM users ORDER BY id'),
      pool.query('SELECT user_id, guild_id, role as guild_role, joined_at FROM guild_members ORDER BY user_id'),
      pool.query('SELECT id, name, slug, owner_id, tier FROM guilds ORDER BY created_at'),
    ]);
    res.json({
      users: users.rows,
      guild_members: members.rows,
      guilds: guilds.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sudo/activity — recent activity log
router.get('/activity', checkSuperAdmin, async (req, res) => {
  try {
    const [recent, today, week] = await Promise.all([
      pool.query(`
        SELECT al.action, al.details, al.created_at,
               g.name as guild_name, u.username
        FROM activity_log al
        LEFT JOIN guilds g ON g.id = al.guild_id
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC LIMIT 30
      `),
      pool.query("SELECT COUNT(*)::int as count FROM activity_log WHERE created_at >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*)::int as count FROM activity_log WHERE created_at >= date_trunc('week', now())"),
    ]);
    res.json({
      recent: recent.rows,
      today: today.rows[0].count,
      thisWeek: week.rows[0].count,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sudo/fix-owner-roles — ensure all guild owners are admin in guild_members
router.post('/fix-owner-roles', checkSuperAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      UPDATE guild_members gm SET role = 'admin'
      FROM guilds g
      WHERE gm.guild_id = g.id AND gm.user_id = g.owner_id AND gm.role != 'admin'
    `);
    res.json({ success: true, fixed: rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sudo/reset-all-data — wipe all guild data, keep user accounts
router.post('/reset-all-data', checkSuperAdmin, async (req, res) => {
  try {
    await pool.query(`
      DELETE FROM roster_members;
      DELETE FROM aliases;
      DELETE FROM wars;
      DELETE FROM guild_invites;
      DELETE FROM guild_members;
      DELETE FROM guilds;
    `);
    res.json({ success: true, message: 'All guild data deleted. User accounts preserved.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
