-- 010_activity_log.sql
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  guild_id UUID REFERENCES guilds(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_guild ON activity_log(guild_id);
