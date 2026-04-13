const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { pool } = require('./db');

const app = express();

app.use(express.json());

// API routes (înainte de static, să nu fie interceptate)
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/wars',    require('./routes/wars'));
app.use('/api/roster',  require('./routes/roster'));
app.use('/api/aliases', require('./routes/aliases'));
app.use('/api/users',   require('./routes/users'));

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

// Admin login page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// Catch-all → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Run migrations on startup
async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
  }
  console.log('Migrations applied:', files.join(', '));
}

const PORT = process.env.PORT || 3000;

runMigrations()
  .then(() => {
    app.listen(PORT, () => console.log(`Wargame Nova listening on :${PORT}`));
  })
  .catch(err => {
    console.error('Migration failed:', err.message, err.stack);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'set (length=' + process.env.DATABASE_URL.length + ')' : 'NOT SET');
    process.exit(1);
  });
