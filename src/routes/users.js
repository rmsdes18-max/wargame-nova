const { Router } = require('express');
const { pool }   = require('../db');
const { requireAuth, guildContext, requireGuildRole } = require('../middleware/guildContext');
const router = Router();

// GET /api/users — list members of current guild (admin only)
router.get('/', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.discord_id, u.avatar, u.created_at,
              gm.role, gm.joined_at
       FROM guild_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.guild_id = $1
       ORDER BY gm.joined_at`,
      [req.guild.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/users/:id — change member role within guild (admin only)
router.patch('/:id', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  const { role } = req.body;
  const targetUserId = parseInt(req.params.id);
  if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Valid role required' });
  }

  // Can't change own role
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE guild_members SET role = $1 WHERE user_id = $2 AND guild_id = $3 RETURNING *',
      [role, targetUserId, req.guild.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found in this guild' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id — kick member from guild (admin only)
router.delete('/:id', requireAuth, guildContext, requireGuildRole('admin'), async (req, res) => {
  const targetUserId = parseInt(req.params.id);

  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
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

module.exports = router;
