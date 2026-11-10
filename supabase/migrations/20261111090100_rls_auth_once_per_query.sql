-- Step 5 clean-up (2026-11-11). The 11 limbus policies that call auth.uid() / auth.role() directly: wrapped in a
-- sub-select so Postgres evaluates it once per query instead of once per row. Same rule, same result.
-- Rollback: supabase/rollback/20261111090100_rls_auth_once_per_query.sql

alter policy bookmarks_delete on limbus.deck_bookmarks using ((select auth.uid()) = user_id);
alter policy bookmarks_insert on limbus.deck_bookmarks with check ((select auth.uid()) = user_id);
alter policy comments_delete on limbus.deck_comments using ((select auth.uid()) = user_id);
alter policy comments_insert on limbus.deck_comments with check ((select auth.uid()) = user_id);
alter policy votes_delete on limbus.deck_votes using ((select auth.uid()) = user_id);
alter policy votes_insert on limbus.deck_votes with check ((select auth.uid()) = user_id);
alter policy decks_delete on limbus.decks using ((select auth.uid()) = user_id);
alter policy decks_insert on limbus.decks with check ((select auth.uid()) = user_id);
alter policy decks_update on limbus.decks using ((select auth.uid()) = user_id);
alter policy profiles_update on limbus.profiles using ((select auth.uid()) = id);
alter policy site_maintenance_write on limbus.site_maintenance using ((select auth.role()) = 'service_role'::text);
