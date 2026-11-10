-- Step 5 clean-up (2026-11-11). Checked against production on 2026-11-11: no site code, script, extractor tool, trigger,
-- policy, cron job or other function calls these.
-- Rollback: supabase/rollback/20261111090000_drop_unused_functions.sql (the definitions as they were).

-- replaced by toggle_deck_vote
drop function if exists limbus.increment_vote(uuid);
-- replaced by toggle_deck_vote
drop function if exists limbus.decrement_vote(uuid);
-- empty body since the comment-count trigger (sync_deck_comment_count)
drop function if exists limbus.increment_comment(uuid);
-- empty body since the comment-count trigger (sync_deck_comment_count)
drop function if exists limbus.decrement_comment(uuid);
-- replaced by discovery_counts_since
drop function if exists limbus.discovery_counts(integer);
-- replaced by discovery_rising_windows
drop function if exists limbus.discovery_rising(text, integer, integer, integer, integer);
-- replaced by discovery_rising_windows
drop function if exists limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer);
-- one-off text clean-up helper, callable by anon; nothing calls it
drop function if exists limbus.dedup_coin_prefix(text);
-- one-off text clean-up helper, callable by anon; nothing calls it
drop function if exists limbus.reorder_skill_desc(text);
