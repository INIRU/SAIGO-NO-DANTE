-- REQ-COMMUNITY-070. Run against a configured development database after 20261020120100; every fixture is rolled back.
begin;
do $$
declare
  hot  uuid := '00000000-0000-0000-0000-0000000000e1';
  flat uuid := '00000000-0000-0000-0000-0000000000e2';
  few  uuid := '00000000-0000-0000-0000-0000000000e3';
  old  uuid := '00000000-0000-0000-0000-0000000000e4';
  today date := (now() at time zone 'UTC')::date;
  i integer;
begin
  assert not has_function_privilege('anon', 'limbus.discovery_rising(text, integer, integer, integer, integer)', 'execute');
  assert not has_function_privilege('authenticated', 'limbus.discovery_rising(text, integer, integer, integer, integer)', 'execute');
  assert has_function_privilege('service_role', 'limbus.discovery_rising(text, integer, integer, integer, integer)', 'execute');
  -- hot: 6 visitors in the last 3 days, 2 before. flat: 6 recent, 20 before. few: 4 recent (below the minimum). old: only visited 30 days ago.
  for i in 1..6 loop
    insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-r' || i, 'deck', hot, today), ('qa-r' || i, 'deck', flat, today - 1);
  end loop;
  for i in 1..2 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-b' || i, 'deck', hot, today - 6); end loop;
  for i in 1..20 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-c' || i, 'deck', flat, today - 8); end loop;
  for i in 1..4 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-f' || i, 'deck', few, today); end loop;
  insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-o', 'deck', old, today - 30);
  assert (select recent = 6 and base = 2 from limbus.discovery_rising('deck') where entity_id = hot);
  assert (select recent = 6 and base = 20 from limbus.discovery_rising('deck') where entity_id = flat);
  assert (select count(*) = 0 from limbus.discovery_rising('deck') where entity_id in (few, old));
  assert (select count(*) = 0 from limbus.discovery_rising('planner') where entity_id = hot);
  assert (select count(*) <= 1 from limbus.discovery_rising('deck', 3, 14, 5, 1));
end $$;
rollback;
