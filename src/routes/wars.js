const { Router } = require('express');
const { pool }   = require('../db');
const auth       = require('../middleware/auth');
const router     = Router();

// GET all wars (newest first)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, opponent, date, parties FROM wars ORDER BY id DESC'
    );
    res.json(rows.map(r => ({
      id: Number(r.id),
      opponent: r.opponent,
      date: r.date,
      parties: r.parties
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single war
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, opponent, date, parties FROM wars WHERE id=$1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'War not found' });
    const r = rows[0];
    res.json({ id: Number(r.id), opponent: r.opponent, date: r.date, parties: r.parties });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create war
router.post('/', auth, async (req, res) => {
  const { id, opponent, date, parties } = req.body;
  if (!id || !opponent || !date) {
    return res.status(400).json({ error: 'id, opponent, date required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO wars (id, opponent, date, parties) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, opponent, date, JSON.stringify(parties || [])]
    );
    const r = rows[0];
    res.status(201).json({ id: Number(r.id), opponent: r.opponent, date: r.date, parties: r.parties });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'War with this id already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update war
router.put('/:id', auth, async (req, res) => {
  const { opponent, date, parties } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE wars SET
        opponent = COALESCE($1, opponent),
        date     = COALESCE($2, date),
        parties  = COALESCE($3::jsonb, parties)
       WHERE id = $4 RETURNING *`,
      [
        opponent || null,
        date || null,
        parties !== undefined ? JSON.stringify(parties) : null,
        req.params.id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'War not found' });
    const r = rows[0];
    res.json({ id: Number(r.id), opponent: r.opponent, date: r.date, parties: r.parties });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE war
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM wars WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'War not found' });
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
