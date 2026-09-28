-- Anyone holding the public key could write these tables: RLS was off (or policies allowed any insert/delete) and anon/
-- authenticated held full grants. The site writes them only through the service role, so the public keeps read access
-- and loses write access. Discord bot tables (feed_tracker, guild_settings, guild_feed_history, tickets, warnings) are
-- written by the bot with the public key and stay as they are.
do $$
declare t text;
begin
  foreach t in array array['skills', 'deck_identities', 'legal_docs', 'identity_sanity_conditions', 'mental_condition_templates', 'panic_types'] loop
    execute format('alter table limbus.%I enable row level security', t);
    execute format('drop policy if exists %I on limbus.%I', t || '_public_read', t);
    execute format('create policy %I on limbus.%I for select using (true)', t || '_public_read', t);
    execute format('revoke insert, update, delete, truncate on limbus.%I from anon, authenticated', t);
  end loop;
end $$;

drop policy if exists deck_egos_insert_auth on limbus.deck_egos;
drop policy if exists deck_egos_delete_auth on limbus.deck_egos;
revoke insert, update, delete, truncate on limbus.deck_egos from anon, authenticated;
