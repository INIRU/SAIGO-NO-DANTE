-- REQ-COMMUNITY-067. Run against a configured development database after 20261020120000; every fixture is rolled back.
begin;
do $$
declare
  target uuid := '00000000-0000-0000-0000-0000000000a1';
  pair   uuid := '00000000-0000-0000-0000-0000000000b1';
  weak   uuid := '00000000-0000-0000-0000-0000000000c1';
  other  uuid := '00000000-0000-0000-0000-0000000000d1';
  i integer;
begin
  assert not has_function_privilege('anon', 'limbus.discovery_covisited(uuid, text, date, integer)', 'execute');
  assert not has_function_privilege('authenticated', 'limbus.discovery_covisited(uuid, text, date, integer)', 'execute');
  assert has_function_privilege('service_role', 'limbus.discovery_covisited(uuid, text, date, integer)', 'execute');
  -- Visitors qa-1..qa-4 see the target and the pair; qa-1 and qa-2 also see weak (below three shared); qa-5..qa-20 only see other.
  for i in 1..4 loop
    insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-' || i, 'deck', target, current_date), ('qa-' || i, 'deck', pair, current_date);
  end loop;
  insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-1', 'deck', weak, current_date), ('qa-2', 'deck', weak, current_date);
  for i in 5..20 loop
    insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-' || i, 'deck', other, current_date);
  end loop;
  -- Same visitors on the other board must not leak into a deck count.
  insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-1', 'planner', pair, current_date), ('qa-2', 'planner', pair, current_date), ('qa-3', 'planner', pair, current_date);
  assert (select count(*) from limbus.discovery_covisited(target, 'deck', current_date) where entity_id = pair and covisitors = 4) = 1;
  assert (select count(*) from limbus.discovery_covisited(target, 'deck', current_date) where entity_id in (weak, other, target)) = 0;
  assert (select count(*) from limbus.discovery_covisited(target, 'planner', current_date)) = 0;
  assert (select count(*) from limbus.discovery_covisited(target, 'deck', current_date + 1)) = 0;
  assert (select count(*) from limbus.discovery_covisited(target, 'deck', current_date, 0)) = 0;
end $$;
rollback;
