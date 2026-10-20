-- REQ-COMMUNITY-070. Run against a configured development database after 20261020150000; every fixture is rolled back.
begin;
do $$
declare
  hot  uuid := '00000000-0000-0000-0000-0000000000e1';
  flat uuid := '00000000-0000-0000-0000-0000000000e2';
  few  uuid := '00000000-0000-0000-0000-0000000000e3';
  gap  uuid := '00000000-0000-0000-0000-0000000000e4';
  today date := (now() at time zone 'UTC')::date;
  i integer;
begin
  assert not has_function_privilege('anon', 'limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer)', 'execute');
  assert not has_function_privilege('authenticated', 'limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer)', 'execute');
  assert has_function_privilege('service_role', 'limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer)', 'execute');
  -- A clean board for the kind: 30 visitors a day over the window (filler entity), so every day passes the day minimum.
  for i in 0..16 loop
    insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day)
      select 'qa-fill-' || i || '-' || n, 'deck', '00000000-0000-0000-0000-0000000000ff', today - i from generate_series(1, 30) n;
  end loop;
  -- hot: 6 visitors in the last 3 days, 2 before. few: 4 recent (below the minimum).
  for i in 1..6 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-r' || i, 'deck', hot, today - 1); end loop;
  for i in 1..2 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-b' || i, 'deck', hot, today - 6); end loop;
  for i in 1..4 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-f' || i, 'deck', few, today - 1); end loop;
  assert (select recent = 6 and base = 2 from limbus.discovery_rising_shares('deck') where entity_id = hot);
  -- Totals count each visitor of the whole kind once per window (fillers 3 days recent incl. today... at least the fillers and hot's visitors).
  assert (select recent_total >= 36 and base_total >= 2 from limbus.discovery_rising_shares('deck') where entity_id = hot);
  assert (select count(*) = 0 from limbus.discovery_rising_shares('deck') where entity_id = few);
  assert (select count(*) = 0 from limbus.discovery_rising_shares('planner') where entity_id = hot);
  assert (select count(*) <= 1 from limbus.discovery_rising_shares('deck', 3, 14, 20, 5, 1));
end $$;
rollback;
