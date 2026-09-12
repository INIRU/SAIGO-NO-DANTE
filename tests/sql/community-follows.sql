-- Isolated accounts and all changes roll back, including privacy settings.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); result jsonb;
begin
  insert into auth.users(id,email) values (a,a||'@example.invalid'),(b,b||'@example.invalid'),(c,c||'@example.invalid');
  insert into limbus.profiles(id) values(a),(b),(c) on conflict do nothing;
  update limbus.profiles set public_profile=true,suspended=false where id in(a,b,c);
  assert not limbus.community_set_follow(a,a,true);
  assert limbus.community_set_follow(a,b,true);
  assert limbus.community_set_follow(a,b,true);
  assert (select count(*)=1 from limbus.follows where follower_id=a and following_id=b), 'idempotent follow';
  result:=limbus.community_follows(b,c,'followers');
  assert not (result->>'can_view')::boolean and result->'items'='[]'::jsonb;
  assert result->'follower_count'='null'::jsonb, 'private count must not leak';
  result:=limbus.community_follows(b,b,'followers');
  assert (result->>'can_view')::boolean and jsonb_array_length(result->'items')=1;
  update limbus.profiles set public_followers=true where id=b;
  result:=limbus.community_follows(b,null,'followers');
  assert jsonb_array_length(result->'items')=1;
  assert not ((result->'items'->0) ? 'email');
  update limbus.profiles set public_following=true where id=a;
  assert jsonb_array_length(limbus.community_follows(a,c,'following')->'items')=1;
  update limbus.profiles set public_profile=false where id=b;
  assert limbus.community_follows(b,c,'followers') is null;
  assert not limbus.community_set_follow(c,b,true);
  assert limbus.community_set_follow(a,b,false), 'unfollow even after target becomes private';
  assert (select count(*)=0 from limbus.follows where follower_id=a and following_id=b);
  update limbus.profiles set suspended=true where id=a;
  assert not limbus.community_set_follow(a,c,true);
  assert not has_table_privilege('anon','limbus.follows','select');
  assert not has_table_privilege('authenticated','limbus.follows','insert');
  assert not has_function_privilege('authenticated','limbus.community_follows(uuid,uuid,text,integer)','execute');
end $$;
rollback;
