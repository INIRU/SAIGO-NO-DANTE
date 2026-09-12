-- Community records are server-owned. Public profiles expose an explicit field allowlist.
create schema if not exists limbus_private;
revoke all on schema limbus_private from public, anon, authenticated;
alter table limbus.profiles add column if not exists public_profile boolean not null default true;
alter table limbus.inquiries add column if not exists contribution_accepted boolean not null default false;
alter table limbus.inquiries add constraint inquiry_contribution_review check (
  not contribution_accepted or (category='data' and status in ('answered','closed') and length(trim(reply))>0 and replied_by is not null)
);
create table limbus.community_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references limbus.profiles(id) on delete cascade,
  action text not null check(action in ('deck','like','contribution')),
  subject_id uuid not null,
  points integer not null check(points>=0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id,action,subject_id)
);
create index community_activity_user_time on limbus.community_activity(user_id,created_at desc);
create index community_activity_subject on limbus.community_activity(subject_id,action);
alter table limbus.community_activity enable row level security;
revoke all on limbus.community_activity from anon,authenticated;
grant all on limbus.community_activity to service_role;
grant usage,select on sequence limbus.community_activity_id_seq to service_role;

create function limbus_private.award_activity(p_user uuid,p_action text,p_subject uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_limit int; v_points int; v_count int;
begin
  if not exists(select 1 from limbus.profiles where id=p_user and not suspended) then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
  v_points:=case p_action when 'deck' then 20 when 'like' then 2 when 'contribution' then 50 else null end;
  if v_points is null then raise exception 'invalid activity'; end if;
  v_limit:=case p_action when 'deck' then 3 when 'like' then 5 else 2147483647 end;
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

create function limbus.community_record_deck(p_deck_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from limbus.decks d where d.id=p_deck_id and d.user_id=p_user_id
    and exists(select 1 from limbus.deck_identities di where di.deck_id=d.id)) then return; end if;
  perform limbus_private.award_activity(p_user_id,'deck',p_deck_id);
end $$;
revoke all on function limbus.community_record_deck(uuid,uuid) from public,anon,authenticated;
grant execute on function limbus.community_record_deck(uuid,uuid) to service_role;

create function limbus_private.community_vote_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if exists(select 1 from limbus.decks where id=new.deck_id and user_id<>new.user_id) then
      perform limbus_private.award_activity(new.user_id,'like',new.deck_id);
    end if;
    return new;
  end if;
  update limbus.community_activity set active=false where user_id=old.user_id and action='like' and subject_id=old.deck_id;
  return old;
end $$;
create trigger community_vote_event after insert or delete on limbus.deck_votes for each row execute function limbus_private.community_vote_event();

create function limbus_private.community_deck_deleted() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update limbus.community_activity set active=false where subject_id=old.id and action in ('deck','like');
  return old;
end $$;
create trigger community_deck_deleted before delete on limbus.decks for each row execute function limbus_private.community_deck_deleted();

create function limbus_private.community_contribution_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    update limbus.community_activity set active=false where user_id=old.user_id and action='contribution' and subject_id=old.id;
    return old;
  end if;
  if new.contribution_accepted then
    perform limbus_private.award_activity(new.user_id,'contribution',new.id);
  else
    update limbus.community_activity set active=false where user_id=new.user_id and action='contribution' and subject_id=new.id;
  end if;
  return new;
end $$;
create trigger community_contribution_event after update of contribution_accepted or delete on limbus.inquiries for each row execute function limbus_private.community_contribution_event();

revoke all on function limbus_private.community_vote_event(),limbus_private.community_deck_deleted(),limbus_private.community_contribution_event() from public,anon,authenticated;

create function limbus.community_summary(p_user_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('points',coalesce(sum(points) filter(where active),0),
    'deck',count(*) filter(where active and action='deck'),
    'like',count(*) filter(where active and action='like'),
    'contribution',count(*) filter(where active and action='contribution'))
  from limbus.community_activity where user_id=p_user_id;
$$;
revoke all on function limbus.community_summary(uuid) from public,anon,authenticated;
grant execute on function limbus.community_summary(uuid) to service_role;

-- NextAuth writes profiles through the server. Prevent direct clients granting themselves
-- roles, and prevent public joins from exposing IP/device/account fields.
revoke all on limbus.profiles from anon,authenticated;
grant select(id,username,avatar_url,bio,created_at,role,public_profile) on limbus.profiles to anon,authenticated;
drop policy if exists profiles_select on limbus.profiles;
create policy profiles_public_select on limbus.profiles for select to anon,authenticated using(public_profile and not suspended);

-- Existing genuine activity gets the same capped rules. Votes have no historic timestamp;
-- importing them does not invent an earlier earn date.
do $$ declare r record; begin
  for r in select d.id,d.user_id from limbus.decks d join limbus.profiles p on p.id=d.user_id order by d.created_at,d.id loop
    perform limbus.community_record_deck(r.id,r.user_id);
  end loop;
  for r in select v.user_id,v.deck_id from limbus.deck_votes v join limbus.decks d on d.id=v.deck_id where d.user_id<>v.user_id order by v.user_id,v.deck_id loop
    perform limbus_private.award_activity(r.user_id,'like',r.deck_id);
  end loop;
end $$;
