-- 006_fresh_start.sql
-- Clean slate: remove all data, keep schema intact
TRUNCATE TABLE guild_invites, guild_members, guilds, wars, roster_members, aliases, users, screenshots_meta CASCADE;
