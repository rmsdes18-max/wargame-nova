const { Router } = require('express');
const { pool }   = require('../db');
const auth       = require('../middleware/auth');
const router     = Router();

// GET all members
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, role, guild_role AS "guildRole" FROM roster_members ORDER BY sort_order, id'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT full roster replace
router.put('/', auth, async (req, res) => {
  const members = req.body;
  if (!Array.isArray(members)) return res.status(400).json({ error: 'Expected array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM roster_members');
    for (let i = 0; i < members.length; i++) {
      const { name, role, guildRole } = members[i];
      await client.query(
        'INSERT INTO roster_members (name, role, guild_role, sort_order) VALUES ($1,$2,$3,$4)',
        [name, role, guildRole || null, i]
      );
    }
    await client.query('COMMIT');
    res.json({ count: members.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// POST add single member
router.post('/', auth, async (req, res) => {
  const { name, role, guildRole } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role required' });
  try {
    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM roster_members'
    );
    await pool.query(
      'INSERT INTO roster_members (name, role, guild_role, sort_order) VALUES ($1,$2,$3,$4)',
      [name, role, guildRole || null, maxRows[0].next]
    );
    res.status(201).json({ name, role, guildRole: guildRole || null });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Member already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH update single member by name
router.patch('/:name', auth, async (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { name: newName, role, guildRole } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE roster_members SET
        name       = COALESCE($1, name),
        role       = COALESCE($2, role),
        guild_role = CASE WHEN $3::boolean THEN $4 ELSE guild_role END
       WHERE name = $5
       RETURNING name, role, guild_role AS "guildRole"`,
      [
        newName || null,
        role || null,
        guildRole !== undefined,
        guildRole !== undefined ? (guildRole || null) : null,
        oldName
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE member by name
router.delete('/:name', auth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const { rowCount } = await pool.query('DELETE FROM roster_members WHERE name=$1', [name]);
    if (!rowCount) return res.status(404).json({ error: 'Member not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
