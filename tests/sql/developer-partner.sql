-- Run against a configured development database; every fixture is rolled back.
begin;
do $$
declare owner_id uuid; v_key uuid; result jsonb; i integer; actor_email text;
begin
  select id into owner_id from limbus.profiles where partner is null limit 1;
  assert owner_id is not null, 'A profile is needed for the FK test';
  insert into limbus.developer_keys(user_id,name,key_hash,prefix) values(owner_id,'qa-partner','qa-partner-hash','qa') returning id into v_key;
  result:=limbus.consume_developer_key('qa-partner-hash',array[]::text[]);
  assert result->>'partner' is null and (result->>'remaining')::int=9999, 'standard keys keep the daily counter';
  update limbus.profiles set partner='limpi' where id=owner_id;
  update limbus.developer_usage set requests=10000 where key_id=v_key;
  update limbus.developer_keys set minute_start=now()-interval '2 minutes' where id=v_key;
  for i in 1..600 loop
    result:=limbus.consume_developer_key('qa-partner-hash',array[]::text[]);
    assert (result->>'status')::int=200, 'partners pass the daily quota and 60/min';
  end loop;
  assert result->>'partner'='limpi' and result->'remaining'='null'::jsonb;
  assert (limbus.consume_developer_key('qa-partner-hash',array[]::text[])->>'status')::int=429, 'the 600/min ceiling still applies';
  assert (select requests=10600 from limbus.developer_usage where key_id=v_key), 'partner usage is still counted';
  update limbus.profiles set partner=null where id=owner_id;
  update limbus.developer_keys set minute_start=now()-interval '2 minutes' where id=v_key;
  assert (limbus.consume_developer_key('qa-partner-hash',array[]::text[])->>'status')::int=429, 'the daily quota returns with the tier';
  begin
    update limbus.profiles set partner='admin' where id=owner_id;
    assert false, 'unknown tiers are rejected';
  exception when foreign_key_violation then null;
  end;
  assert (limbus.admin_set_partner('nobody@example.invalid',owner_id,'limpi',array[]::text[])->>'error')='forbidden';
  -- An actor listed in ADMIN_EMAILS sets and clears the tier; each change leaves one audit row.
  select u.email into actor_email from limbus.profiles p join auth.users u on u.id=p.id where p.id<>owner_id and not coalesce(p.suspended,false) and coalesce(p.role,'user')='user' limit 1;
  assert (limbus.admin_set_partner(actor_email,owner_id,'limpi',array[]::text[])->>'error')='forbidden';
  assert limbus.admin_set_partner(actor_email,owner_id,'limpi',array[actor_email])='{"ok":true}'::jsonb;
  assert (select partner='limpi' from limbus.profiles where id=owner_id);
  assert (limbus.admin_set_partner(actor_email,owner_id,'admin',array[actor_email])->>'error')='invalid';
  assert limbus.admin_set_partner(actor_email,owner_id,null,array[actor_email])='{"ok":true}'::jsonb;
  assert (select partner is null from limbus.profiles where id=owner_id);
  assert (select count(*)=2 from limbus.audit_logs a where a.action='set_partner' and a.target_id=owner_id::text and a.created_at>=transaction_timestamp());
  assert (limbus.admin_set_partner(actor_email,'00000000-0000-4000-8000-000000000000',null,array[actor_email])->>'error')='not_found';
  assert not has_function_privilege('anon','limbus.admin_set_partner(text,uuid,text,text[])','execute');
  assert not has_function_privilege('authenticated','limbus.admin_set_partner(text,uuid,text,text[])','execute');
end $$;
rollback;
