-- 011_guild_region_server.sql
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS server TEXT;
