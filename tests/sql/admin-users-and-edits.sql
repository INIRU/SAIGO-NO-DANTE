-- Run with a migration-capable connection. All fixture rows roll back.
BEGIN;
DO $$
DECLARE
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  d uuid := gen_random_uuid(); p uuid := gen_random_uuid();
  mail text; stamp timestamptz; r jsonb;
BEGIN
  mail := a::text || '@example.invalid';
  INSERT INTO auth.users(id,email) VALUES(a,mail),(b,b::text||'@example.invalid'),(c,c::text||'@example.invalid');
  INSERT INTO limbus.profiles(id,username,role) VALUES(a,a::text,'admin'),(b,b::text,'user'),(c,c::text,'user') ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,username=EXCLUDED.username;
  ASSERT NOT has_table_privilege('anon','limbus.audit_logs','select');
  ASSERT NOT has_table_privilege('authenticated','limbus.audit_logs','select');
  ASSERT NOT has_function_privilege('authenticated','limbus.admin_moderate_user(text,uuid,boolean,text,integer,timestamptz,text[])','execute');
  ASSERT NOT has_function_privilege('anon','limbus.admin_list_users(text,text,integer,integer)','execute');
  ASSERT has_function_privilege('service_role','limbus.admin_list_users(text,text,integer,integer)','execute');
  r := limbus.admin_list_users(b::text||'@example.invalid','active',0,20);
  ASSERT jsonb_array_length(r->'users')=1 AND NOT (r->'users'->0 ? 'email');
  ASSERT limbus.admin_moderate_user(c::text||'@example.invalid',b,true,'reason',7,null,'{}')->>'error'='forbidden';
  ASSERT limbus.admin_moderate_user(mail,a,true,'reason',7,null,'{}')->>'error'='protected';
  ASSERT limbus.admin_moderate_user(mail,b,true,' ',7,null,'{}')->>'error'='invalid';
  ASSERT limbus.admin_moderate_user(mail,b,true,'reason',2,null,'{}')->>'error'='invalid';
  ASSERT limbus.admin_moderate_user(mail,b,true,'reason',7,null,ARRAY[b::text||'@example.invalid'])->>'error'='protected';
  ASSERT limbus.admin_moderate_user(mail,b,true,'reason',7,null,'{}')->>'ok'='true';
  SELECT suspended_at INTO stamp FROM limbus.profiles WHERE id=b;
  ASSERT (SELECT suspended AND suspended_until=now()+interval '7 days' AND suspension_reason='reason' FROM limbus.profiles WHERE id=b);
  ASSERT (SELECT count(*)=1 FROM limbus.audit_logs WHERE target_id=b::text AND action='suspend');
  ASSERT limbus.admin_moderate_user(mail,b,true,'again',30,stamp,'{}')->>'error'='conflict';
  ASSERT limbus.admin_moderate_user(mail,b,false,null,null,null,'{}')->>'error'='conflict';
  ASSERT limbus.admin_moderate_user(mail,b,false,null,null,stamp,'{}')->>'ok'='true';
  ASSERT (SELECT NOT suspended AND suspended_at IS NULL AND suspension_reason IS NULL FROM limbus.profiles WHERE id=b);
  ASSERT (SELECT count(*)=2 FROM limbus.audit_logs WHERE target_id=b::text);
  ASSERT limbus.admin_moderate_user(mail,b,true,'indefinite',null,null,'{}')->>'ok'='true';
  ASSERT (SELECT suspended AND suspended_until IS NULL FROM limbus.profiles WHERE id=b);
  UPDATE limbus.profiles SET suspended_until=now()-interval '1 day' WHERE id=b;
  ASSERT (limbus.admin_list_users(b::text,'suspended',0,20)->>'total')::int=0;
  ASSERT (limbus.admin_list_users(b::text,'active',0,20)->>'total')::int=1;
  UPDATE limbus.profiles SET suspended=true,suspended_until=null WHERE id=a;
  ASSERT limbus.admin_moderate_user(mail,c,true,'reason',7,null,'{}')->>'error'='forbidden';

  INSERT INTO limbus.decks(id,title,user_id) VALUES(d,'Regression fixture',a);
  INSERT INTO limbus.md_plans(id,title,user_id) VALUES(p,'Regression fixture',a);
  UPDATE limbus.decks SET view_count=coalesce(view_count,0)+1,updated_at=now()+interval '1 second' WHERE id=d;
  UPDATE limbus.md_plans SET vote_count=1,updated_at=now()+interval '1 second' WHERE id=p;
  INSERT INTO limbus.audit_logs(actor_id,action,target_type,target_id) VALUES(a,'deck_create','deck',d::text),(a,'planner_create','planner',p::text);
  ASSERT NOT EXISTS(SELECT 1 FROM limbus.discovery_recent_edits('deck') WHERE entity_id=d::text);
  ASSERT NOT EXISTS(SELECT 1 FROM limbus.discovery_recent_edits('planner') WHERE entity_id=p::text);
  INSERT INTO limbus.audit_logs(actor_id,action,target_type,target_id) VALUES(a,'deck_update','deck',d::text),(a,'deck_update','deck',d::text),(a,'planner_update','planner',p::text);
  ASSERT (SELECT count(*)=1 FROM limbus.discovery_recent_edits('deck') WHERE entity_id=d::text);
  ASSERT NOT EXISTS(SELECT 1 FROM limbus.discovery_recent_edits('planner') WHERE entity_id=p::text);
  UPDATE limbus.md_plans SET title='Actually edited fixture' WHERE id=p;
  ASSERT (SELECT count(*)=1 FROM limbus.discovery_recent_edits('planner') WHERE entity_id=p::text);
  ASSERT NOT has_function_privilege('anon','limbus.discovery_recent_edits(text)','execute');
END $$;
ROLLBACK;
