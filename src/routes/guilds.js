const { Router } = require('express');
const { pool }   = require('../db');
const { requireAuth, guildContext, requireGuildRole, checkFreeTierLimits } = require('../middleware/guildContext');
const router = Router();

// Slugify helper
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

// ── GET /api/guilds — list current user's guilds ──
router.get('/', requireAuth, async (req, res) => {
  try {
    // Auto-fix: ensure guild owners always have admin role
    await pool.query(`
      UPDATE guild_members gm SET role = 'admin'
      FROM guilds g
      WHERE gm.guild_id = g.id AND gm.user_id = g.owner_id AND gm.role != 'admin' AND gm.user_id = $1
    `, [req.user.id]);

    const { rows } = await pool.query(
      `SELECT g.id, g.name, g.slug, g.tier, g.invite_code, gm.role,
              (SELECT COUNT(*)::int FROM guild_members WHERE guild_id = g.id) as member_count
       FROM guilds g
       JOIN guild_members gm ON gm.guild_id = g.id
       WHERE gm.user_id = $1
       ORDER BY gm.joined_at`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/guilds — create new guild ──
router.post('/', requireAuth, async (req, res) => {
  const { name, invite_code } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Guild name required' });

  const slug = slugify(name);
  if (!slug) return res.status(400).json({ error: 'Invalid guild name' });

  // Verify user exists in DB (token may reference stale ID after DB reset)
  const { rows: userCheck } = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
  if (!userCheck.length) {
    return res.status(401).json({ error: 'Session expired. Please log out and log in again.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inviteCode = (invite_code || '').trim() || undefined; // let DB generate if empty
    const insertQ = inviteCode
      ? 'INSERT INTO guilds (name, slug, owner_id, invite_code) VALUES ($1, $2, $3, $4) RETURNING *'
      : 'INSERT INTO guilds (name, slug, owner_id) VALUES ($1, $2, $3) RETURNING *';
    const insertP = inviteCode ? [name.trim(), slug, req.user.id, inviteCode] : [name.trim(), slug, req.user.id];

    const { rows } = await client.query(insertQ, insertP);
    const guild = rows[0];

    // Creator becomes admin
    await client.query(
      'INSERT INTO guild_members (user_id, guild_id, role) VALUES ($1, $2, $3)',
      [req.user.id, guild.id, 'admin']
    );

    await client.query('COMMIT');
    res.status(201).json({ ...guild, role: 'admin', member_count: 1 });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') {
      if (e.constraint?.includes('slug')) return res.status(409).json({ error: 'Guild name already taken' });
      if (e.constraint?.includes('invite_code')) return res.status(409).json({ error: 'Invite code already taken' });
    }
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ── GET /api/guilds/:id — guild details (members only) ──
router.get('/:id', requireAuth, guildContext, async (req, res) => {
  try {
    const { rows: members } = await pool.query(
      `SELECT u.id, u.username, u.discord_id, u.avatar, u.created_at as user_created_at,
              gm.role, gm.joined_at
       FROM guild_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.guild_id = $1
       ORDER BY gm.joined_at`,
      [req.guild.id]
    );
    res.json({
      ...req.guild,
      members,
      your_role: req.guildMember.role,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/guilds/:id — update guild settings (admin only) ──
router.patch('/:id', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  const { name, settings } = req.body;
  try {
    const setClauses = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(name.trim());
      setClauses.push(`slug = $${idx++}`);
      params.push(slugify(name));
    }
    if (settings !== undefined) {
      setClauses.push(`settings = $${idx++}`);
      params.push(JSON.stringify(settings));
    }

    if (!setClauses.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.guild.id);
    const { rows } = await pool.query(
      `UPDATE guilds SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/guilds/:id — delete guild (owner only) ──
router.delete('/:id', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  if (req.guild.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the guild owner can delete it' });
  }
  try {
    await pool.query('DELETE FROM guilds WHERE id = $1', [req.guild.id]);
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/guilds/:id/invite — generate invite link (admin only) ──
router.post('/:id/invite', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  const { expires_hours, max_uses, default_role } = req.body;
  const role = ['viewer', 'editor'].includes(default_role) ? default_role : 'viewer';

  // Free tier: check if can invite as editor
  if (role === 'editor' && req.guild.tier === 'free') {
    const limits = await checkFreeTierLimits(req.guild.id, req.guild.tier);
    if (limits.editors >= 1) {
      return res.status(403).json({ error: 'Free tier: max 1 editor. Upgrade to Pro.' });
    }
  }

  try {
    const expiresAt = expires_hours ? new Date(Date.now() + expires_hours * 3600000) : null;
    const { rows } = await pool.query(
      `INSERT INTO guild_invites (guild_id, created_by, expires_at, max_uses, default_role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.guild.id, req.user.id, expiresAt, max_uses || null, role]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/guilds/join — join guild with invite code ──
router.post('/join', requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Invite code required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Try guild permanent invite_code first
    let guildId = null;
    let joinRole = 'viewer';
    const { rows: guildRows } = await client.query(
      'SELECT id, tier FROM guilds WHERE invite_code = $1', [code]
    );

    if (guildRows.length) {
      guildId = guildRows[0].id;
      // Permanent code — check guild settings for default role
      const { rows: guildSettings } = await client.query('SELECT settings FROM guilds WHERE id = $1', [guildId]);
      if (guildSettings.length && guildSettings[0].settings?.default_invite_role) {
        joinRole = guildSettings[0].settings.default_invite_role;
      }
    } else {
      // Try temporary invite link
      const { rows: inviteRows } = await client.query(
        `SELECT gi.id, gi.guild_id, gi.max_uses, gi.uses, gi.expires_at, gi.default_role, g.tier
         FROM guild_invites gi JOIN guilds g ON g.id = gi.guild_id
         WHERE gi.code = $1`, [code]
      );
      if (!inviteRows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invalid invite code' });
      }
      const invite = inviteRows[0];
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(410).json({ error: 'Invite has expired' });
      }
      if (invite.max_uses && invite.uses >= invite.max_uses) {
        await client.query('ROLLBACK');
        return res.status(410).json({ error: 'Invite has reached max uses' });
      }
      guildId = invite.guild_id;
      joinRole = invite.default_role || 'viewer';

      // Increment uses
      await client.query('UPDATE guild_invites SET uses = uses + 1 WHERE id = $1', [invite.id]);
    }

    // Free tier: check editor limit
    if (joinRole === 'editor') {
      const { rows: tierCheck } = await client.query('SELECT tier FROM guilds WHERE id = $1', [guildId]);
      if (tierCheck[0]?.tier === 'free') {
        const { rows: editorCount } = await client.query(
          "SELECT COUNT(*)::int as count FROM guild_members WHERE guild_id = $1 AND role = 'editor'", [guildId]
        );
        if (editorCount[0].count >= 1) joinRole = 'viewer'; // fallback to viewer
      }
    }

    // Check if already a member
    const { rows: existing } = await client.query(
      'SELECT 1 FROM guild_members WHERE user_id = $1 AND guild_id = $2',
      [req.user.id, guildId]
    );
    if (existing.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Already a member of this guild' });
    }

    // Add with determined role
    await client.query(
      'INSERT INTO guild_members (user_id, guild_id, role) VALUES ($1, $2, $3)',
      [req.user.id, guildId, joinRole]
    );

    // Get guild info for response
    const { rows: guildInfo } = await client.query('SELECT id, name, slug FROM guilds WHERE id = $1', [guildId]);

    await client.query('COMMIT');
    res.status(201).json({ guild: guildInfo[0], role: joinRole });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ── POST /api/guilds/:id/members/:userId/role — change member role (admin only) ──
router.post('/:id/members/:userId/role', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  const { role } = req.body;
  const targetUserId = parseInt(req.params.userId);
  if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Valid role required (admin, editor, viewer)' });
  }

  // Can't change own role
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }

  // Free tier limits
  if (req.guild.tier === 'free' && (role === 'admin' || role === 'editor')) {
    const limits = await checkFreeTierLimits(req.guild.id, req.guild.tier);
    if (role === 'admin' && limits.admins >= 1) {
      return res.status(403).json({ error: 'Free tier: max 1 admin per guild. Upgrade to Pro.' });
    }
    if (role === 'editor' && limits.editors >= 1) {
      return res.status(403).json({ error: 'Free tier: max 1 editor per guild. Upgrade to Pro.' });
    }
  }

  try {
    const { rows } = await pool.query(
      'UPDATE guild_members SET role = $1 WHERE user_id = $2 AND guild_id = $3 RETURNING *',
      [role, targetUserId, req.guild.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/guilds/:id/members/:userId — kick member (admin only) ──
router.delete('/:id/members/:userId', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  const targetUserId = parseInt(req.params.userId);

  // Can't kick yourself
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'Cannot kick yourself. Use leave instead.' });
  }

  // Can't kick the owner
  if (targetUserId === req.guild.owner_id) {
    return res.status(403).json({ error: 'Cannot kick the guild owner' });
  }

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM guild_members WHERE user_id = $1 AND guild_id = $2',
      [targetUserId, req.guild.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Member not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/guilds/:id/leave — leave guild ──
router.post('/:id/leave', requireAuth, guildContext, async (req, res) => {
  // Owner can't leave (must transfer or delete)
  if (req.user.id === req.guild.owner_id) {
    return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete the guild.' });
  }

  try {
    await pool.query(
      'DELETE FROM guild_members WHERE user_id = $1 AND guild_id = $2',
      [req.user.id, req.guild.id]
    );
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
