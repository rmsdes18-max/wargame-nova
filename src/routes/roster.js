const { Router } = require('express');
const { pool }   = require('../db');
const auth       = require('../middleware/auth');
const router     = Router();

// GET all members (optionally filter by ?active=true/false)
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT name, role, guild_role AS "guildRole", active FROM roster_members';
    const params = [];
    if (req.query.active !== undefined) {
      query += ' WHERE active = $1';
      params.push(req.query.active === 'true');
    }
    query += ' ORDER BY sort_order, id';
    const { rows } = await pool.query(query, params);
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
      const { name, role, guildRole, active } = members[i];
      await client.query(
        'INSERT INTO roster_members (name, role, guild_role, sort_order, active) VALUES ($1,$2,$3,$4,$5)',
        [name, role, guildRole || null, i, active !== false]
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
      'INSERT INTO roster_members (name, role, guild_role, sort_order, active) VALUES ($1,$2,$3,$4,true)',
      [name, role, guildRole || null, maxRows[0].next]
    );
    res.status(201).json({ name, role, guildRole: guildRole || null, active: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Member already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH update single member by name
router.patch('/:name', auth, async (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { name: newName, role, guildRole, active } = req.body;
  try {
    const setClauses = [];
    const params = [];
    let idx = 1;

    if (newName !== undefined) { setClauses.push(`name = $${idx++}`); params.push(newName); }
    if (role !== undefined) { setClauses.push(`role = $${idx++}`); params.push(role); }
    if (guildRole !== undefined) { setClauses.push(`guild_role = $${idx++}`); params.push(guildRole || null); }
    if (active !== undefined) { setClauses.push(`active = $${idx++}`); params.push(active); }

    if (!setClauses.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(oldName);
    const query = `UPDATE roster_members SET ${setClauses.join(', ')} WHERE name = $${idx} RETURNING name, role, guild_role AS "guildRole", active`;
    const { rows } = await pool.query(query, params);
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
