CREATE TABLE IF NOT EXISTS token_usage (
  id SERIAL PRIMARY KEY,
  guild_id INTEGER,
  user_id INTEGER,
  model VARCHAR(64) NOT NULL DEFAULT 'unknown',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
  endpoint VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_guild ON token_usage(guild_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);
