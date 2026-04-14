const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { pool } = require('./db');

const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers (CSP off — inline scripts in HTML)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true,
  credentials: true
}));

// Rate limiting — general: 300 req / 15 min
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// Rate limiting — auth: 50 req / 15 min (anti brute-force)
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false }));

app.use(express.json());

// API routes (înainte de static, să nu fie interceptate)
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/guilds',  require('./routes/guilds'));
app.use('/api/wars',    require('./routes/wars'));
app.use('/api/roster',  require('./routes/roster'));
app.use('/api/aliases', require('./routes/aliases'));
app.use('/api/users',   require('./routes/users'));
app.use('/api/ocr',     require('./routes/ocr'));
app.use('/api/sudo',    require('./routes/sudo'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frontend static files
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// /members redirects to SPA
app.get(['/members', '/membrii'], (req, res) => {
  res.redirect('/');
});

// Admin login page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// Sudo panel (super admin only — auth check is in API, page is just static)
app.get('/sudo', (req, res) => {
  res.sendFile(path.join(publicDir, 'sudo.html'));
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
    app.listen(PORT, () => console.log(`Wartl API listening on :${PORT}`));
  })
  .catch(err => {
    console.error('Migration failed:', err.message, err.stack);
    console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'set (length=' + process.env.DATABASE_URL.length + ')' : 'NOT SET');
    process.exit(1);
  });
