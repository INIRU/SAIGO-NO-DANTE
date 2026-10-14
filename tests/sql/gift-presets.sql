-- REQ-MIRROR-DUNGEON-019, 021. Run against a configured development database; every fixture is rolled back.
begin;
do $$
declare owner_id uuid; one_group jsonb := '[{"name":"최우선 먹기","gifts":["9001","9002"],"memo":"2층 전에"}]';
begin
  assert not has_table_privilege('anon', 'limbus.gift_presets', 'select') and not has_table_privilege('authenticated', 'limbus.gift_presets', 'select'), 'presets are service-role only';
  assert not has_table_privilege('anon', 'limbus.gift_presets', 'insert') and not has_table_privilege('authenticated', 'limbus.gift_presets', 'update');
  assert has_table_privilege('service_role', 'limbus.gift_presets', 'select') and has_table_privilege('service_role', 'limbus.gift_presets', 'insert')
    and has_table_privilege('service_role', 'limbus.gift_presets', 'update') and has_table_privilege('service_role', 'limbus.gift_presets', 'delete'), 'the route reads and writes';
  assert (select relrowsecurity from pg_class where oid = 'limbus.gift_presets'::regclass), 'row level security is on';

  select id into owner_id from limbus.profiles limit 1;
  assert owner_id is not null, 'A profile is needed for the preset test';

  -- A preset in a slot; an empty name is allowed (the screen shows a default one).
  insert into limbus.gift_presets(user_id, slot, name, groups) values(owner_id, 1, '화상 덱', one_group);
  insert into limbus.gift_presets(user_id, slot, groups) values(owner_id, 5, one_group);
  begin insert into limbus.gift_presets(user_id, slot, name, groups) values(owner_id, 1, '둘째', one_group); assert false, 'one preset per slot';
  exception when unique_violation then null; end;
  begin insert into limbus.gift_presets(user_id, slot, groups) values(owner_id, 6, one_group); assert false, 'five slots';
  exception when check_violation then null; end;
  begin insert into limbus.gift_presets(user_id, slot, groups) values(owner_id, 0, one_group); assert false, 'slots start at one';
  exception when check_violation then null; end;
  begin insert into limbus.gift_presets(user_id, slot, name, groups) values(owner_id, 2, repeat('가', 21), one_group); assert false, 'a name is twenty characters at most';
  exception when check_violation then null; end;
  begin insert into limbus.gift_presets(user_id, slot, groups) values(owner_id, 2, '[]'); assert false, 'a preset has a group';
  exception when check_violation then null; end;
  begin insert into limbus.gift_presets(user_id, slot, groups) values(owner_id, 2, '{"name":""}'); assert false, 'groups is an array';
  exception when check_violation then null; end;
  begin insert into limbus.gift_presets(user_id, slot, groups) values(owner_id, 2, (select jsonb_agg(one_group -> 0) from generate_series(1, 7))); assert false, 'six groups at most';
  exception when check_violation then null; end;
  begin insert into limbus.gift_presets(user_id, slot, groups) values(owner_id, 2, jsonb_build_array(jsonb_build_object('name', '', 'gifts', '[]'::jsonb, 'memo', repeat('x', 9000)))); assert false, 'groups are bounded in size';
  exception when check_violation then null; end;
  -- The fullest preset the route accepts fits: six groups, Korean names and notes, sixty gifts.
  insert into limbus.gift_presets(user_id, slot, name, groups) values(owner_id, 2, repeat('가', 20),
    (select jsonb_agg(jsonb_build_object('name', repeat('나', 20), 'memo', repeat('다', 100),
      'gifts', (select jsonb_agg((90000 + g * 10 + i)::text) from generate_series(1, 10) i))) from generate_series(1, 6) g));

  -- Presets go with their account.
  assert (select confdeltype from pg_constraint where conrelid = 'limbus.gift_presets'::regclass and contype = 'f') = 'c', 'deleting a profile deletes its presets';
end $$;
rollback;
