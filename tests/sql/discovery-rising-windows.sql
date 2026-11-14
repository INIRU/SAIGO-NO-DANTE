-- Run against a configured development database after 20261020103915; every fixture is rolled back.
begin;
do $$
declare
  hot  uuid := '00000000-0000-0000-0000-0000000000f1';
  today date := (now() at time zone 'UTC')::date;
  i integer;
begin
  assert not has_function_privilege('anon', 'limbus.discovery_rising_windows(text, integer, integer, numeric, integer)', 'execute');
  assert not has_function_privilege('authenticated', 'limbus.discovery_rising_windows(text, integer, integer, numeric, integer)', 'execute');
  assert has_function_privilege('service_role', 'limbus.discovery_rising_windows(text, integer, integer, numeric, integer)', 'execute');
  -- A clean board for the kind: 30 visitors a day over 28 days, except days 3 and 4 ago (a gap in the log: 5 visitors).
  for i in 0..27 loop
    insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day)
      select 'qa-fill-' || i || '-' || n, 'deck', '00000000-0000-0000-0000-0000000000ff', today - i
      from generate_series(1, case when i in (3, 4) then 5 else 30 end) n;
  end loop;
  -- hot: 3 visitors on a good day of the recent window, 2 on a gap day (dropped), 1 in the base window.
  for i in 1..3 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-r' || i, 'deck', hot, today - 1); end loop;
  for i in 1..2 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-g' || i, 'deck', hot, today - 3); end loop;
  insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-b1', 'deck', hot, today - 10);
  assert (select recent = 3 and base = 1 from limbus.discovery_rising_windows('deck') where entity_id = hot);
  -- The two gap days are in neither window's total: the filler visitors of the 7 recent days minus the two gap days.
  assert (select recent_total >= 30 * 5 and recent_total < 30 * 5 + 10 from limbus.discovery_rising_windows('deck') where entity_id = hot);
  assert (select count(*) = 0 from limbus.discovery_rising_windows('planner') where entity_id = hot);
  assert (select count(*) <= 1 from limbus.discovery_rising_windows('deck', 7, 21, 0.4, 1));
end $$;
rollback;
