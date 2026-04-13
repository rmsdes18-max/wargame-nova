-- 005_multi_guild.sql
-- Transform single-guild into multi-guild SaaS

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════
-- 1. GUILDS TABLE
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS guilds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tier        TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guilds_slug ON guilds(slug);
CREATE INDEX IF NOT EXISTS idx_guilds_invite_code ON guilds(invite_code);

-- Updated_at trigger for guilds
DROP TRIGGER IF EXISTS guilds_updated_at ON guilds;
CREATE TRIGGER guilds_updated_at
  BEFORE UPDATE ON guilds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════
-- 2. GUILD MEMBERS (junction table)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS guild_members (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guild_id  UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_user ON guild_members(user_id);

-- ═══════════════════════════════════════════════════════════
-- 3. GUILD INVITES (temporary invite links)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS guild_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id   UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  max_uses   INTEGER,
  uses       INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guild_invites_code ON guild_invites(code);
CREATE INDEX IF NOT EXISTS idx_guild_invites_guild ON guild_invites(guild_id);

-- ═══════════════════════════════════════════════════════════
-- 4. ADD guild_id TO EXISTING TABLES
-- ═══════════════════════════════════════════════════════════

-- 4a. Wars
ALTER TABLE wars ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_wars_guild ON wars(guild_id);

-- 4b. Roster members — add guild_id, adjust unique constraint
ALTER TABLE roster_members ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_roster_guild ON roster_members(guild_id);

-- Drop old unique constraint on name (single-guild), add guild-scoped one
ALTER TABLE roster_members DROP CONSTRAINT IF EXISTS roster_members_name_key;
-- Use DO block to avoid error if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roster_members_guild_name_unique'
  ) THEN
    ALTER TABLE roster_members ADD CONSTRAINT roster_members_guild_name_unique UNIQUE (guild_id, name);
  END IF;
END $$;

-- 4c. Aliases — add guild_id, adjust primary key
ALTER TABLE aliases ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE;
-- Drop old PK and create new one with guild_id
ALTER TABLE aliases DROP CONSTRAINT IF EXISTS aliases_pkey;
ALTER TABLE aliases ADD PRIMARY KEY (guild_id, normalized_key, type);

-- ═══════════════════════════════════════════════════════════
-- 5. MIGRATE EXISTING DATA → DEFAULT GUILD "Nova"
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
  nova_guild_id UUID;
  first_admin_id INTEGER;
BEGIN
  -- Skip if Nova guild already exists (idempotent)
  SELECT id INTO nova_guild_id FROM guilds WHERE slug = 'nova';
  IF nova_guild_id IS NOT NULL THEN
    RAISE NOTICE 'Guild "Nova" already exists, skipping data migration';
    RETURN;
  END IF;

  -- Find the first admin user (or any user) to be guild owner
  SELECT id INTO first_admin_id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF first_admin_id IS NULL THEN
    SELECT id INTO first_admin_id FROM users ORDER BY created_at LIMIT 1;
  END IF;

  -- Create the default Nova guild
  INSERT INTO guilds (name, slug, invite_code, owner_id, tier)
  VALUES ('Nova', 'nova', 'nova-og', first_admin_id, 'pro')
  RETURNING id INTO nova_guild_id;

  -- Move all existing wars to Nova guild
  UPDATE wars SET guild_id = nova_guild_id WHERE guild_id IS NULL;

  -- Move all existing roster members to Nova guild
  UPDATE roster_members SET guild_id = nova_guild_id WHERE guild_id IS NULL;

  -- Move all existing aliases to Nova guild
  UPDATE aliases SET guild_id = nova_guild_id WHERE guild_id IS NULL;

  -- Add all existing users as guild members with their current roles
  INSERT INTO guild_members (user_id, guild_id, role)
  SELECT id, nova_guild_id, role FROM users
  ON CONFLICT (user_id, guild_id) DO NOTHING;

  RAISE NOTICE 'Migrated all data to guild "Nova" (id: %)', nova_guild_id;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 6. MAKE guild_id NOT NULL (after data migration)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE wars ALTER COLUMN guild_id SET NOT NULL;
ALTER TABLE roster_members ALTER COLUMN guild_id SET NOT NULL;
ALTER TABLE aliases ALTER COLUMN guild_id SET NOT NULL;
