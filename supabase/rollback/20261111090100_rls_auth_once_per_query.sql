-- Puts the 11 policies back to the direct auth.uid() / auth.role() calls they had on 2026-11-11.

alter policy bookmarks_delete on limbus.deck_bookmarks using (auth.uid() = user_id);
alter policy bookmarks_insert on limbus.deck_bookmarks with check (auth.uid() = user_id);
alter policy comments_delete on limbus.deck_comments using (auth.uid() = user_id);
alter policy comments_insert on limbus.deck_comments with check (auth.uid() = user_id);
alter policy votes_delete on limbus.deck_votes using (auth.uid() = user_id);
alter policy votes_insert on limbus.deck_votes with check (auth.uid() = user_id);
alter policy decks_delete on limbus.decks using (auth.uid() = user_id);
alter policy decks_insert on limbus.decks with check (auth.uid() = user_id);
alter policy decks_update on limbus.decks using (auth.uid() = user_id);
alter policy profiles_update on limbus.profiles using (auth.uid() = id);
alter policy site_maintenance_write on limbus.site_maintenance using (auth.role() = 'service_role'::text);
