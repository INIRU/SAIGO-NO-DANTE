-- Account deletion (DELETE /api/profile): limbus.delete_user_account was never applied to this database, so every
-- deletion answered 500. The function removes what the user wrote and clears the links that would stop the profile
-- delete; the rows that point at the profile with ON DELETE CASCADE (votes, bookmarks, plan comments, follows, friend
-- posts, presets, keys, push subscriptions, consent records, activity) go with the profile. The route then deletes the
-- auth user.
--
-- An admin whose reply was accepted as a data contribution cannot be deleted this way: that inquiry needs its replier
-- (inquiry_contribution_review), so the profile delete fails and nothing is removed.
--
-- Rollback: drop function if exists limbus.delete_user_account(uuid);

create or replace function limbus.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Posts are removed rather than left without an author (decks.user_id and md_plans.user_id are ON DELETE SET NULL).
  -- Their slots, votes, bookmarks, comments, series entries and guest keys go with them.
  delete from limbus.decks where user_id = p_user_id;
  delete from limbus.md_plans where user_id = p_user_id;
  -- Comments on other people's decks; replies under them go too (parent_id is ON DELETE CASCADE).
  delete from limbus.deck_comments where user_id = p_user_id;

  -- These links are ON DELETE NO ACTION and would stop the profile delete.
  delete from limbus.inquiries where user_id = p_user_id;
  update limbus.support_messages set author_id = null where author_id = p_user_id;
  update limbus.inquiries set replied_by = null where replied_by = p_user_id and not contribution_accepted;
  update limbus.audit_logs set actor_id = null where actor_id = p_user_id;

  delete from limbus.profiles where id = p_user_id;
end;
$$;

revoke all on function limbus.delete_user_account(uuid) from public, anon, authenticated;
grant execute on function limbus.delete_user_account(uuid) to service_role;
