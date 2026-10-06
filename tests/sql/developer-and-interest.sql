-- Run against a configured development database; every fixture is rolled back.
begin;
do $$
declare owner_id uuid; v_key uuid; result jsonb; i integer;
begin
  -- A partner account has other limits (tests/sql/developer-partner.sql).
  select id into owner_id from limbus.profiles where partner is null limit 1;
  assert owner_id is not null, 'A profile is needed for the FK test';
  insert into limbus.developer_keys(user_id,name,key_hash,prefix) values(owner_id,'qa-rollback','qa-rollback-hash','qa') returning id into v_key;
  for i in 1..60 loop
    result:=limbus.consume_developer_key('qa-rollback-hash',array[]::text[]);
    assert (result->>'status')::int=200;
  end loop;
  assert (limbus.consume_developer_key('qa-rollback-hash',array[]::text[])->>'status')::int=429;
  assert (select requests=60 from limbus.developer_usage where key_id=v_key);
  update limbus.developer_keys set minute_start=now()-interval '2 minutes' where id=v_key;
  update limbus.developer_usage set requests=10000 where key_id=v_key;
  assert (limbus.consume_developer_key('qa-rollback-hash',array[]::text[])->>'status')::int=429;
  update limbus.developer_keys set revoked_at=now() where id=v_key;
  assert (limbus.consume_developer_key('qa-rollback-hash',array[]::text[])->>'status')::int=401;
  assert not has_table_privilege('anon','limbus.developer_keys','select');
  assert not has_table_privilege('authenticated','limbus.discovery_visits','select');
  assert not has_function_privilege('anon','limbus.consume_developer_key(text,text[])','execute');
  assert to_regprocedure('limbus.consume_developer_request(text)') is null, 'the old key check is gone';
  insert into limbus.discovery_visits(visitor_hash,kind,entity_id,day) values
    ('qa-one','identity','00000000-0000-0000-0000-000000000000',current_date),
    ('qa-one','identity','00000000-0000-0000-0000-000000000000',current_date-1),
    ('qa-two','identity','00000000-0000-0000-0000-000000000000',current_date-10),
    ('qa-old','identity','00000000-0000-0000-0000-000000000000',current_date-40);
  result:=limbus.identity_interest('00000000-0000-0000-0000-000000000000');
  assert result='{"week":1,"month":2,"all":3}'::jsonb;
end $$;
rollback;
