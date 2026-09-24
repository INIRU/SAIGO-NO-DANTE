-- Logged-in browsing history for personal "for you" shelves.
-- Anonymous visits keep user_id null; deleting a profile deletes its history.
alter table limbus.discovery_visits
  add column user_id uuid references limbus.profiles(id) on delete cascade;
create index discovery_visits_user_idx
  on limbus.discovery_visits(user_id, day desc) where user_id is not null;

-- Resolves the NextAuth email to an existing profile without creating accounts.
create function limbus.discovery_user_id(user_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from limbus.profiles p join auth.users u on u.id = p.id
  where u.email = user_email limit 1
$$;
revoke all on function limbus.discovery_user_id(text) from public, anon, authenticated;
grant execute on function limbus.discovery_user_id(text) to service_role;
