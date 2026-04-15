ALTER TABLE wars ADD COLUMN IF NOT EXISTS share_token UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wars_share_token ON wars(share_token);
