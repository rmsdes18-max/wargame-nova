-- Add status column to roster_members (active/inactive/external)
-- Keeps boolean `active` field for backwards compatibility

ALTER TABLE roster_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Add check constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roster_members_status_check'
  ) THEN
    ALTER TABLE roster_members ADD CONSTRAINT roster_members_status_check
      CHECK (status IN ('active', 'inactive', 'external'));
  END IF;
END $$;

-- Migrate existing data: sync status from active boolean
UPDATE roster_members SET status = CASE WHEN active = true THEN 'active' ELSE 'inactive' END
WHERE status = 'active' AND active = false;

-- Index for fast filtering by guild + status
CREATE INDEX IF NOT EXISTS idx_roster_guild_status ON roster_members (guild_id, status);

-- Trigger: keep `active` boolean in sync with `status`
CREATE OR REPLACE FUNCTION sync_roster_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.active = (NEW.status = 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS roster_sync_active ON roster_members;
CREATE TRIGGER roster_sync_active
  BEFORE INSERT OR UPDATE OF status ON roster_members
  FOR EACH ROW EXECUTE FUNCTION sync_roster_active();
