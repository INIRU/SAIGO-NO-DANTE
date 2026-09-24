-- Plans earn activity like decks: publishing a plan with identities and liking another manager's plan.
alter table limbus.community_activity drop constraint community_activity_action_check;
alter table limbus.community_activity add constraint community_activity_action_check check(action in ('deck','plan','like','contribution'));

create or replace function limbus_private.award_activity(p_user uuid,p_action text,p_subject uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_limit int; v_points int; v_count int;
begin
  if not exists(select 1 from limbus.profiles where id=p_user and not suspended) then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
  v_points:=case p_action when 'deck' then 20 when 'plan' then 20 when 'like' then 2 when 'contribution' then 50 else null end;
  if v_points is null then raise exception 'invalid activity'; end if;
  v_limit:=case p_action when 'deck' then 3 when 'plan' then 3 when 'like' then 5 else 2147483647 end;
  if exists(select 1 from limbus.community_activity where user_id=p_user and action=p_action and subject_id=p_subject) then
    -- Reactivation restores the original award, never creates a second daily grant.
    update limbus.community_activity set active=true where user_id=p_user and action=p_action and subject_id=p_subject;
  else
    select count(*) into v_count from limbus.community_activity
      where user_id=p_user and action=p_action and points>0
      and (created_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date;
    insert into limbus.community_activity(user_id,action,subject_id,points)
      values(p_user,p_action,p_subject,case when v_count<v_limit then v_points else 0 end);
  end if;
end $$;
revoke all on function limbus_private.award_activity(uuid,text,uuid) from public,anon,authenticated;

create function limbus.community_record_plan(p_plan_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from limbus.md_plans p where p.id=p_plan_id and p.user_id=p_user_id
    and pg_catalog.jsonb_path_exists(p.deck,'$[*].identity_id ? (@ != null && @ != "")')) then return; end if;
  perform limbus_private.award_activity(p_user_id,'plan',p_plan_id);
end $$;
revoke all on function limbus.community_record_plan(uuid,uuid) from public,anon,authenticated;
grant execute on function limbus.community_record_plan(uuid,uuid) to service_role;

create function limbus_private.community_plan_vote_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if exists(select 1 from limbus.md_plans where id=new.plan_id and user_id<>new.user_id) then
      perform limbus_private.award_activity(new.user_id,'like',new.plan_id);
    end if;
    return new;
  end if;
  update limbus.community_activity set active=false where user_id=old.user_id and action='like' and subject_id=old.plan_id;
  return old;
end $$;
create trigger community_plan_vote_event after insert or delete on limbus.md_plan_votes for each row execute function limbus_private.community_plan_vote_event();

create function limbus_private.community_plan_deleted() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update limbus.community_activity set active=false where subject_id=old.id and action in ('plan','like');
  return old;
end $$;
create trigger community_plan_deleted before delete on limbus.md_plans for each row execute function limbus_private.community_plan_deleted();
revoke all on function limbus_private.community_plan_vote_event(),limbus_private.community_plan_deleted() from public,anon,authenticated;

create or replace function limbus.community_summary(p_user_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('points',coalesce(sum(points) filter(where active),0),
    'deck',count(*) filter(where active and action='deck'),
    'plan',count(*) filter(where active and action='plan'),
    'like',count(*) filter(where active and action='like'),
    'contribution',count(*) filter(where active and action='contribution'))
  from limbus.community_activity where user_id=p_user_id;
$$;
revoke all on function limbus.community_summary(uuid) from public,anon,authenticated;
grant execute on function limbus.community_summary(uuid) to service_role;

-- Existing plans keep their real publish day, so the daily cap applies per original KST day.
insert into limbus.community_activity(user_id,action,subject_id,points,created_at)
select user_id,'plan',id,case when rn<=3 then 20 else 0 end,created_at from (
  select p.user_id,p.id,p.created_at,row_number() over(partition by p.user_id,(p.created_at at time zone 'Asia/Seoul')::date order by p.created_at,p.id) rn
  from limbus.md_plans p join limbus.profiles pr on pr.id=p.user_id and not pr.suspended
  where pg_catalog.jsonb_path_exists(p.deck,'$[*].identity_id ? (@ != null && @ != "")')
) s
on conflict (user_id,action,subject_id) do nothing;

-- Plan votes have no timestamp; like the deck import, they count on the migration day.
do $$ declare r record; begin
  for r in select v.user_id,v.plan_id from limbus.md_plan_votes v join limbus.md_plans p on p.id=v.plan_id where p.user_id<>v.user_id order by v.user_id,v.plan_id loop
    perform limbus_private.award_activity(r.user_id,'like',r.plan_id);
  end loop;
end $$;
