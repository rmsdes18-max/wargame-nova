const { Router } = require('express');
const { pool }   = require('../db');
const { requireAuth, guildContext, requireGuildRole, checkFreeTierLimits } = require('../middleware/guildContext');
const router = Router();

// GET all wars for current guild (newest first)
router.get('/', requireAuth, guildContext, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, opponent, date, parties FROM wars WHERE guild_id = $1 ORDER BY id DESC',
      [req.guild.id]
    );
    res.json(rows.map(r => ({
      id: Number(r.id),
      opponent: r.opponent,
      date: r.date,
      parties: r.parties
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single war (must belong to current guild)
router.get('/:id', requireAuth, guildContext, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, opponent, date, parties FROM wars WHERE id = $1 AND guild_id = $2',
      [req.params.id, req.guild.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'War not found' });
    const r = rows[0];
    res.json({ id: Number(r.id), opponent: r.opponent, date: r.date, parties: r.parties });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create war (editor+)
router.post('/', requireAuth, guildContext, requireGuildRole('editor'), async (req, res) => {
  const { id, opponent, date, parties } = req.body;
  if (!id || !opponent || !date) {
    return res.status(400).json({ error: 'id, opponent, date required' });
  }

  // Free tier: max 3 wars per month
  if (req.guild.tier === 'free') {
    const limits = await checkFreeTierLimits(req.guild.id, req.guild.tier);
    if (limits.warsThisMonth >= 3) {
      return res.status(403).json({ error: 'Free tier: max 3 wars per month. Upgrade to Pro.' });
    }
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO wars (id, opponent, date, parties, guild_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, opponent, date, JSON.stringify(parties || []), req.guild.id]
    );
    const r = rows[0];

    // Auto-sync roster: upsert all party members into roster_members
    const partyList = Array.isArray(parties) ? parties : [];
    let sortOrder = 0;
    for (const party of partyList) {
      if (party._isExtras || party.name === '_Extras') continue;
      const members = Array.isArray(party.members) ? party.members : [];
      for (const m of members) {
        if (!m.name) continue;
        const role = ['TANK', 'HEALER', 'DPS'].includes(m.role) ? m.role : 'DPS';
        await pool.query(
          `INSERT INTO roster_members (name, role, guild_id, sort_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (guild_id, name) DO UPDATE SET role = EXCLUDED.role`,
          [m.name.trim(), role, req.guild.id, sortOrder++]
        );
      }
    }

    res.status(201).json({ id: Number(r.id), opponent: r.opponent, date: r.date, parties: r.parties });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'War with this id already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update war (editor+, must belong to guild)
router.put('/:id', requireAuth, guildContext, requireGuildRole('editor'), async (req, res) => {
  const { opponent, date, parties } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE wars SET
        opponent = COALESCE($1, opponent),
        date     = COALESCE($2, date),
        parties  = COALESCE($3::jsonb, parties)
       WHERE id = $4 AND guild_id = $5 RETURNING *`,
      [
        opponent || null,
        date || null,
        parties !== undefined ? JSON.stringify(parties) : null,
        req.params.id,
        req.guild.id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'War not found' });
    const r = rows[0];
    res.json({ id: Number(r.id), opponent: r.opponent, date: r.date, parties: r.parties });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE war (editor+, must belong to guild)
router.delete('/:id', requireAuth, guildContext, requireGuildRole('editor'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM wars WHERE id = $1 AND guild_id = $2',
      [req.params.id, req.guild.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'War not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
