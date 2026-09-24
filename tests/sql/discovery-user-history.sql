-- Run against a configured development database after 20260924120000; every fixture is rolled back.
begin;
do $$
declare owner_id uuid; owner_email text;
begin
  select p.id, u.email into owner_id, owner_email from limbus.profiles p join auth.users u on u.id = p.id limit 1;
  assert owner_id is not null, 'A profile with an auth user is needed';
  assert limbus.discovery_user_id(owner_email) = owner_id;
  assert limbus.discovery_user_id('nobody@example.invalid') is null;
  assert not has_function_privilege('anon', 'limbus.discovery_user_id(text)', 'execute');
  assert not has_function_privilege('authenticated', 'limbus.discovery_user_id(text)', 'execute');
  assert not has_table_privilege('authenticated', 'limbus.discovery_visits', 'select');
  insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day, user_id)
    values ('qa-user', 'deck', '00000000-0000-0000-0000-000000000000', current_date, owner_id);
  assert (select count(*) = 1 from limbus.discovery_visits where user_id = owner_id and visitor_hash = 'qa-user');
end $$;
rollback;
