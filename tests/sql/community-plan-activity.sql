-- Isolated accounts; every plan, vote and activity row rolls back.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); p1 uuid; p2 uuid; s jsonb;
begin
  insert into auth.users(id,email) values (a,a||'@example.invalid'),(b,b||'@example.invalid');
  insert into limbus.profiles(id) values(a),(b) on conflict do nothing;
  update limbus.profiles set suspended=false where id in(a,b);
  insert into limbus.md_plans(user_id,title,deck) values(a,'plan','[{"identity_id":"x"}]') returning id into p1;
  insert into limbus.md_plans(user_id,title,deck) values(a,'empty','[]') returning id into p2;
  perform limbus.community_record_plan(p1,a);
  perform limbus.community_record_plan(p1,a);
  perform limbus.community_record_plan(p2,a);
  s:=limbus.community_summary(a);
  assert (s->>'plan')::int=1 and (s->>'points')::int=20, 'one plan with identities earns 20 once';
  perform limbus.toggle_plan_vote(p1,b);
  perform limbus.toggle_plan_vote(p1,a);
  assert (limbus.community_summary(b)->>'points')::int=2, 'liking another plan earns 2';
  assert (limbus.community_summary(a)->>'like')::int=0, 'own plan likes earn nothing';
  perform limbus.toggle_plan_vote(p1,b);
  assert (limbus.community_summary(b)->>'points')::int=0, 'unlike removes the points';
  perform limbus.toggle_plan_vote(p1,b);
  delete from limbus.md_plans where id=p1;
  assert (limbus.community_summary(a)->>'points')::int=0, 'deleting the plan removes its points';
  assert (limbus.community_summary(b)->>'points')::int=0, 'deleting the plan removes like points';
  assert not has_function_privilege('authenticated','limbus.community_record_plan(uuid,uuid)','execute');
end $$;
rollback;
