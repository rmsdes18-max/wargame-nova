const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { pool } = require('./db');

const app = express();

app.use(express.json());

// API routes (înainte de static, să nu fie interceptate)
app.use('/api/wars',    require('./routes/wars'));
app.use('/api/roster',  require('./routes/roster'));
app.use('/api/aliases', require('./routes/aliases'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frontend static files
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// URL prietenos pentru pagina Membrii
app.get(['/members', '/membrii'], (req, res) => {
  res.sendFile(path.join(publicDir, 'members.html'));
});

// Catch-all → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Run migrations on startup
async function runMigrations() {
  const sql = fs.readFileSync(
    path.join(__dirname, '../migrations/001_init.sql'),
    'utf8'
  );
  await pool.query(sql);
  console.log('Migrations applied');
}

const PORT = process.env.PORT || 3000;

runMigrations()
  .then(() => {
    app.listen(PORT, () => console.log(`Wargame Nova listening on :${PORT}`));
  })
  .catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
