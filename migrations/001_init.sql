CREATE TABLE IF NOT EXISTS wars (
  id         BIGINT PRIMARY KEY,
  opponent   TEXT NOT NULL,
  date       TEXT NOT NULL,
  parties    JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roster_members (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('TANK','HEALER','DPS')),
  guild_role TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aliases (
  normalized_key TEXT NOT NULL,
  actual_name    TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('war','member')),
  PRIMARY KEY (normalized_key, type)
);

CREATE TABLE IF NOT EXISTS screenshots_meta (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wars_updated_at ON wars;
CREATE TRIGGER wars_updated_at
  BEFORE UPDATE ON wars
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
