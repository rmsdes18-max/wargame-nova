const { pool } = require('../db');

// Import verifyToken from auth routes
let _verifyToken = null;
function getVerifyToken() {
  if (!_verifyToken) _verifyToken = require('../routes/auth').verifyToken;
  return _verifyToken;
}

// Resolve current user from Authorization header (JWT token)
function resolveUserFromToken(req) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) return null;
  return getVerifyToken()(token);
}

// Middleware: attach req.user from JWT token
async function requireAuth(req, res, next) {
  const user = resolveUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

// Middleware: attach req.guild and req.guildMember
// Requires requireAuth to have run first (req.user must exist)
async function guildContext(req, res, next) {
  const guildId = req.headers['x-guild-id'];
  if (!guildId) return res.status(400).json({ error: 'X-Guild-ID header required' });

  try {
    // Check guild exists
    const { rows: guildRows } = await pool.query(
      'SELECT id, name, slug, tier, owner_id, settings FROM guilds WHERE id = $1',
      [guildId]
    );
    if (!guildRows.length) return res.status(404).json({ error: 'Guild not found' });

    // Check platform super admin (env-based, bypasses membership check)
    const isSuperAdmin = req.headers['x-admin-secret'] === process.env.ADMIN_SECRET && process.env.ADMIN_SECRET;
    if (isSuperAdmin) {
      req.guild = guildRows[0];
      req.guildMember = { role: 'admin' };
      return next();
    }

    // Check user is member of this guild
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication required' });
    const { rows: memberRows } = await pool.query(
      'SELECT role, joined_at FROM guild_members WHERE user_id = $1 AND guild_id = $2',
      [req.user.id, guildId]
    );
    if (!memberRows.length) return res.status(403).json({ error: 'Not a member of this guild' });

    req.guild = guildRows[0];
    req.guildMember = memberRows[0];
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Middleware factory: require minimum role within guild
function requireGuildRole(minRole) {
  const hierarchy = { viewer: 0, editor: 1, admin: 2 };
  return function (req, res, next) {
    if (!req.guildMember) return res.status(403).json({ error: 'Guild context required' });
    const userLevel = hierarchy[req.guildMember.role] || 0;
    const requiredLevel = hierarchy[minRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Requires ${minRole} role or higher` });
    }
    next();
  };
}

// Helper: check free tier limits
async function checkFreeTierLimits(guildId, tier) {
  if (tier !== 'free') return null; // no limits for pro

  const limits = {};

  // Check editor+admin count (max 1 admin + 1 editor for free)
  const { rows: roleCounts } = await pool.query(
    `SELECT role, COUNT(*)::int as count FROM guild_members
     WHERE guild_id = $1 AND role IN ('admin', 'editor') GROUP BY role`,
    [guildId]
  );
  limits.admins = 0;
  limits.editors = 0;
  roleCounts.forEach(r => {
    if (r.role === 'admin') limits.admins = r.count;
    if (r.role === 'editor') limits.editors = r.count;
  });

  // Check wars this month (max 3)
  const { rows: warCount } = await pool.query(
    `SELECT COUNT(*)::int as count FROM wars
     WHERE guild_id = $1 AND created_at >= date_trunc('month', now())`,
    [guildId]
  );
  limits.warsThisMonth = warCount[0].count;

  return limits;
}

module.exports = {
  requireAuth,
  guildContext,
  requireGuildRole,
  checkFreeTierLimits,
  resolveUserFromToken,
};
