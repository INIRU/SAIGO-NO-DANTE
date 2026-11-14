-- The auth user id for an email in one query. findOrCreateSupabaseUser (lib/supabase/find-or-create-user.ts) used to try
-- creating the user on every signed-in request and, on "already registered", page through every auth user: about
-- 11,000 failed creates and 11,000 user listings a day (Supabase auth logs, 2026-11-14). Without this function the code
-- still works the old way.
--
-- Rollback: drop function if exists limbus.auth_user_id_by_email(text);

create or replace function limbus.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) order by created_at limit 1;
$$;

revoke all on function limbus.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function limbus.auth_user_id_by_email(text) to service_role;
