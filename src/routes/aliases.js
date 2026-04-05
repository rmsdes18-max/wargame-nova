const { Router } = require('express');
const { pool }   = require('../db');
const auth       = require('../middleware/auth');
const router     = Router();

function validateType(req, res) {
  if (!['war', 'member'].includes(req.params.type)) {
    res.status(400).json({ error: 'type must be "war" or "member"' });
    return false;
  }
  return true;
}

// GET all aliases of a type as flat object
router.get('/:type', async (req, res) => {
  if (!validateType(req, res)) return;
  try {
    const { rows } = await pool.query(
      'SELECT normalized_key, actual_name FROM aliases WHERE type=$1',
      [req.params.type]
    );
    const obj = {};
    rows.forEach(r => { obj[r.normalized_key] = r.actual_name; });
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT full replace
router.put('/:type', auth, async (req, res) => {
  if (!validateType(req, res)) return;
  const obj = req.body;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return res.status(400).json({ error: 'Expected flat object { key: value }' });
  }
  const { type } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM aliases WHERE type=$1', [type]);
    const entries = Object.entries(obj);
    for (const [k, v] of entries) {
      await client.query(
        'INSERT INTO aliases (normalized_key, actual_name, type) VALUES ($1,$2,$3)',
        [k, v, type]
      );
    }
    await client.query('COMMIT');
    res.json({ count: entries.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// PATCH partial update (set + delete individual keys)
router.patch('/:type', auth, async (req, res) => {
  if (!validateType(req, res)) return;
  const { type } = req.params;
  const { set = {}, delete: del = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let updated = 0, deleted = 0;
    for (const [k, v] of Object.entries(set)) {
      await client.query(
        `INSERT INTO aliases (normalized_key, actual_name, type) VALUES ($1,$2,$3)
         ON CONFLICT (normalized_key, type) DO UPDATE SET actual_name = $2`,
        [k, v, type]
      );
      updated++;
    }
    for (const k of del) {
      const { rowCount } = await client.query(
        'DELETE FROM aliases WHERE normalized_key=$1 AND type=$2',
        [k, type]
      );
      deleted += rowCount;
    }
    await client.query('COMMIT');
    res.json({ updated, deleted });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

module.exports = router;
