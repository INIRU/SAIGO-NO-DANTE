-- Run against a configured development database after 20261020103915; every fixture is rolled back.
begin;
do $$
declare
  hot  uuid := '00000000-0000-0000-0000-0000000000e1';
  today date := (now() at time zone 'UTC')::date;
  i integer;
begin
  assert not has_function_privilege('anon', 'limbus.discovery_rising_windows(text, integer, integer, numeric, integer)', 'execute');
  assert not has_function_privilege('authenticated', 'limbus.discovery_rising_windows(text, integer, integer, numeric, integer)', 'execute');
  assert has_function_privilege('service_role', 'limbus.discovery_rising_windows(text, integer, integer, numeric, integer)', 'execute');
  -- A steady board: 30 visitors a day over both windows (filler entity), so no day is dropped as a gap.
  for i in 0..27 loop
    insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day)
      select 'qa-fill-' || i || '-' || n, 'deck', '00000000-0000-0000-0000-0000000000ff', today - i from generate_series(1, 30) n;
  end loop;
  -- hot: 6 visitors in the last 7 days, 2 in the 21 before.
  for i in 1..6 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-r' || i, 'deck', hot, today - 1); end loop;
  for i in 1..2 loop insert into limbus.discovery_visits(visitor_hash, kind, entity_id, day) values ('qa-b' || i, 'deck', hot, today - 10); end loop;
  assert (select recent = 6 and base = 2 from limbus.discovery_rising_windows(post_kind => 'deck', max_rows => 3000) where entity_id = hot);
  -- Totals count each visitor of the whole kind once per window.
  assert (select recent_total >= 216 and base_total >= 632 from limbus.discovery_rising_windows(post_kind => 'deck', max_rows => 3000) where entity_id = hot);
  assert (select count(*) = 0 from limbus.discovery_rising_windows(post_kind => 'planner', max_rows => 3000) where entity_id = hot);
  assert (select count(*) <= 1 from limbus.discovery_rising_windows(post_kind => 'deck', max_rows => 1));
end $$;
rollback;
