-- Plans take much more work than decks (floors, gifts, notes): publishing one is worth 40 points, twice a deck.
create or replace function limbus_private.award_activity(p_user uuid,p_action text,p_subject uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_limit int; v_points int; v_count int;
begin
  if not exists(select 1 from limbus.profiles where id=p_user and not suspended) then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
  v_points:=case p_action when 'deck' then 20 when 'plan' then 40 when 'like' then 2 when 'contribution' then 50 else null end;
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

-- Plans already awarded keep their daily-cap outcome; only the value of an awarded plan changes.
update limbus.community_activity set points=40 where action='plan' and points=20;
