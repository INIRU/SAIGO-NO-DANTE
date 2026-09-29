-- The Discord bot (Steam/Twitter feed, tickets, warnings) is shut down and nothing in the site reads these tables.
-- All five were open to anon for every write. No foreign key, view, trigger, function or cron job refers to them.
-- Rows at drop time are kept in backups/2026-09-29/; supabase/rollback/drop_discord_bot_tables.sql restores the schema.
begin;
set local lock_timeout = '5s';
drop table if exists limbus.guild_feed_history;
drop table if exists limbus.guild_settings;
drop table if exists limbus.feed_tracker;
drop table if exists limbus.tickets;
drop table if exists limbus.warnings;
commit;
