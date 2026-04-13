-- 009_invite_role.sql — Add default role to invites and guild settings
ALTER TABLE guild_invites ADD COLUMN IF NOT EXISTS default_role TEXT NOT NULL DEFAULT 'viewer' CHECK (default_role IN ('viewer', 'editor'));
