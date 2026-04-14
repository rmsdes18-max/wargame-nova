const { pool } = require('../db');

async function logActivity(guildId, userId, action, details) {
  try {
    await pool.query(
      'INSERT INTO activity_log (guild_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [guildId || null, userId || null, action, details || null]
    );
  } catch (e) {
    console.error('[ActivityLog] Failed:', e.message);
  }
}

module.exports = { logActivity };
