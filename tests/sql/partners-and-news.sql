-- REQ-ACCOUNT-018, REQ-ADMIN-009, REQ-NEWS-003. Run against a configured development database; every fixture is rolled back.
begin;
do $$
declare owner_id uuid; result jsonb; actor_email text; first_id uuid;
begin
  assert (select scopes = array['catalog:read','news:write'] from limbus.partners where code='limpi'), 'limpi is seeded with both scopes';
  assert not exists(select 1 from limbus.profiles where partner='discord_bot'), 'the old tier value is migrated';
  assert not has_table_privilege('anon','limbus.partners','select') and not has_table_privilege('authenticated','limbus.news_items','select');

  select id into owner_id from limbus.profiles where partner is null and coalesce(role,'user')='user' limit 1;
  assert owner_id is not null, 'A profile is needed for the FK test';
  insert into limbus.developer_keys(user_id,name,key_hash,prefix) values(owner_id,'qa-scopes','qa-scopes-hash','qa');
  result:=limbus.consume_developer_key('qa-scopes-hash',array[]::text[]);
  assert result->>'partner' is null and result->'scopes'='[]'::jsonb and result->'admin'='false'::jsonb, 'a standard key has no scopes';
  -- An administrator is known by role or by an address the route passes from ADMIN_EMAILS.
  select u.email into actor_email from auth.users u where u.id=owner_id;
  assert limbus.consume_developer_key('qa-scopes-hash',array[actor_email])->'admin'='true'::jsonb;
  assert limbus.consume_developer_key('qa-scopes-hash',array['nobody@example.invalid'])->'admin'='false'::jsonb;
  update limbus.profiles set role='admin' where id=owner_id;
  assert limbus.consume_developer_key('qa-scopes-hash',array[]::text[])->'admin'='true'::jsonb;
  update limbus.profiles set role='user' where id=owner_id;
  assert not has_function_privilege('anon','limbus.consume_developer_key(text,text[])','execute');

  -- A partner of another kind: its keys carry only its own scopes.
  insert into limbus.partners(code,name,scopes) values('qa_reader','QA',array['catalog:read']);
  update limbus.profiles set partner='qa_reader' where id=owner_id;
  result:=limbus.consume_developer_key('qa-scopes-hash',array[]::text[]);
  assert result->>'partner'='qa_reader' and result->'scopes'='["catalog:read"]'::jsonb and result->'remaining'='null'::jsonb;
  update limbus.profiles set partner='limpi' where id=owner_id;
  assert limbus.consume_developer_key('qa-scopes-hash',array[]::text[])->'scopes'='["catalog:read","news:write"]'::jsonb;
  begin
    update limbus.profiles set partner='discord_bot' where id=owner_id;
    assert false, 'unregistered codes are rejected';
  exception when foreign_key_violation then null;
  end;

  select u.email into actor_email from limbus.profiles p join auth.users u on u.id=p.id where p.id<>owner_id and not coalesce(p.suspended,false) limit 1;
  assert (limbus.admin_set_partner(actor_email,owner_id,'discord_bot',array[actor_email])->>'error')='invalid';
  assert limbus.admin_set_partner(actor_email,owner_id,'qa_reader',array[actor_email])='{"ok":true}'::jsonb;
  assert (select partner='qa_reader' from limbus.profiles where id=owner_id);
  assert limbus.admin_set_partner(actor_email,owner_id,null,array[actor_email])='{"ok":true}'::jsonb;

  -- The same partner and id is one row; another partner may reuse the id.
  insert into limbus.news_items(partner,external_id,feed,platform,published_at,content)
    values('limpi','qa:1','limbus','steam',now(),'{"ko":{"title":"가"}}') returning id into first_id;
  insert into limbus.news_items(partner,external_id,feed,platform,published_at,content)
    values('limpi','qa:1','limbus','steam',now(),'{"ko":{"title":"나"}}')
    on conflict(partner,external_id) do update set content=excluded.content, updated_at=now();
  assert (select count(*)=1 and min(id::text)=first_id::text and min(content->'ko'->>'title')='나' from limbus.news_items where partner='limpi' and external_id='qa:1');
  insert into limbus.news_items(partner,external_id,feed,platform,published_at,content) values('qa_reader','qa:1','limbus','steam',now(),'{"ko":{"title":"가"}}');
  assert (select category='notice' and spoiler=false from limbus.news_items where id=first_id);
end $$;
rollback;
