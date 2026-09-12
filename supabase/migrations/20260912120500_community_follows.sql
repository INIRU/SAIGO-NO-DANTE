alter table limbus.profiles
  add column if not exists public_following boolean not null default false,
  add column if not exists public_followers boolean not null default false;

create table limbus.follows (
  follower_id uuid not null references limbus.profiles(id) on delete cascade,
  following_id uuid not null references limbus.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on limbus.follows (following_id, created_at desc, follower_id);
create index follows_follower_recent_idx on limbus.follows (follower_id, created_at desc, following_id);
alter table limbus.follows enable row level security;
revoke all on limbus.follows from public, anon, authenticated;
grant all on limbus.follows to service_role;

-- All privacy decisions and list reads share one statement snapshot. Viewer IDs
-- are supplied by the authenticated server, never by a public RPC caller.
create function limbus.community_follows(p_user uuid, p_viewer uuid default null, p_kind text default null, p_offset integer default 0)
returns jsonb language sql stable security definer set search_path = '' as $$
  with target as (
    select p.* from limbus.profiles p where p.id=p_user and not p.suspended
      and (p.public_profile or p.id=p_viewer)
  ), permitted as (
    select t.*, coalesce(t.id=p_viewer,false) as owner,
      (coalesce(t.id=p_viewer,false) or t.public_following) as can_following,
      (coalesce(t.id=p_viewer,false) or t.public_followers) as can_followers
    from target t
  ), members as (
    select p.id,p.username,p.avatar_url,p.bio,f.created_at,
      exists(select 1 from limbus.follows mine where mine.follower_id=p_viewer and mine.following_id=p.id) as is_following
    from permitted t join limbus.follows f on
      (p_kind='following' and t.can_following and f.follower_id=t.id) or
      (p_kind='followers' and t.can_followers and f.following_id=t.id)
    join limbus.profiles p on p.id=case when p_kind='following' then f.following_id else f.follower_id end
    where not p.suspended and (p.public_profile or t.owner)
    order by f.created_at desc,p.id
    limit 25 offset greatest(0,least(p_offset,100000))
  )
  select jsonb_build_object(
    'owner',t.owner,
    'public_following',t.public_following,'public_followers',t.public_followers,
    'following_count',case when t.can_following then (select count(*) from limbus.follows where follower_id=t.id) else null end,
    'follower_count',case when t.can_followers then (select count(*) from limbus.follows where following_id=t.id) else null end,
    'is_following',exists(select 1 from limbus.follows where follower_id=p_viewer and following_id=t.id),
    'can_view',case p_kind when 'following' then t.can_following when 'followers' then t.can_followers else true end,
    'items',coalesce((select jsonb_agg(to_jsonb(m) - 'created_at') from members m),'[]'::jsonb)
  ) from permitted t;
$$;
revoke all on function limbus.community_follows(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function limbus.community_follows(uuid,uuid,text,integer) to service_role;

create function limbus.community_set_follow(p_actor uuid,p_target uuid,p_follow boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_actor=p_target or not exists(select 1 from limbus.profiles where id=p_actor and not suspended) then return false; end if;
  if p_follow then
    if not exists(select 1 from limbus.profiles where id=p_target and public_profile and not suspended) then return false; end if;
    insert into limbus.follows(follower_id,following_id) values(p_actor,p_target) on conflict do nothing;
  else
    delete from limbus.follows where follower_id=p_actor and following_id=p_target;
  end if;
  return true;
end;
$$;
revoke all on function limbus.community_set_follow(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function limbus.community_set_follow(uuid,uuid,boolean) to service_role;
