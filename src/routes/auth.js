const { Router } = require('express');
const { pool }   = require('../db');
const crypto     = require('crypto');
const router     = Router();

const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI || '';
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET || '';
if (!JWT_SECRET) console.error('WARNING: JWT_SECRET not set — auth will not work');

// Simple JWT-like token (base64 encoded JSON + signature)
function createToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); }
  catch (e) { return null; }
}

// GET /api/auth/discord — redirect to Discord OAuth2
router.get('/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) return res.status(500).json({ error: 'Discord not configured' });
  const redirect = DISCORD_REDIRECT_URI || (req.protocol + '://' + req.get('host') + '/api/auth/discord/callback');
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString());
});

// GET /api/auth/discord/callback — exchange code for token
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const redirect = DISCORD_REDIRECT_URI || (req.protocol + '://' + req.get('host') + '/api/auth/discord/callback');

  try {
    // Exchange code for access token
    const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect,
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) return res.status(401).send('Discord auth failed');

    // Get user info
    const userResp = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    const discordUser = await userResp.json();
    if (!discordUser.id) return res.status(401).send('Could not get Discord user');

    // Upsert user in DB
    const avatarUrl = discordUser.avatar
      ? 'https://cdn.discordapp.com/avatars/' + discordUser.id + '/' + discordUser.avatar + '.png'
      : null;
    const username = discordUser.global_name || discordUser.username;

    let { rows } = await pool.query('SELECT id, username, role, discord_id, avatar FROM users WHERE discord_id = $1', [discordUser.id]);

    if (!rows.length) {
      // New user — default role: viewer
      const result = await pool.query(
        'INSERT INTO users (username, role, discord_id, avatar) VALUES ($1, $2, $3, $4) RETURNING id, username, role, discord_id, avatar',
        [username, 'viewer', discordUser.id, avatarUrl]
      );
      rows = result.rows;
    } else {
      // Update avatar + username
      await pool.query('UPDATE users SET avatar = $1, username = $2 WHERE discord_id = $3', [avatarUrl, username, discordUser.id]);
      rows[0].avatar = avatarUrl;
      rows[0].username = username;
    }

    const user = rows[0];

    // Create session token
    const token = createToken({ id: user.id, username: user.username, role: user.role, avatar: user.avatar, discord_id: user.discord_id });

    // Log login
    try { const { logActivity } = require('../services/activityLog'); logActivity(null, user.id, 'user_login', user.username); } catch(e){}

    // Redirect back to app with token in hash (client picks it up)
    res.redirect('/#auth=' + token);
  } catch (e) {
    console.error('Discord OAuth error:', e);
    res.status(500).send('Auth error: ' + e.message);
  }
});

// POST /api/auth/admin — admin login with username + password
router.post('/admin', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Hardcoded admin check via env vars
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || process.env.ADMIN_SECRET;

  if (username === adminUser && password === adminPass) {
    const token = createToken({ id: 0, username: adminUser, role: 'admin', avatar: null, discord_id: null });
    return res.json({ token, username: adminUser, role: 'admin' });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// GET /api/auth/me — verify token, return user
router.get('/me', (req, res) => {
  // Check cookie or Authorization header
  const token = req.cookies?.nova_token || (req.headers.authorization || '').replace('Bearer ', '');
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(user);
});

// Middleware export for other routes
router.verifyToken = verifyToken;

module.exports = router;
