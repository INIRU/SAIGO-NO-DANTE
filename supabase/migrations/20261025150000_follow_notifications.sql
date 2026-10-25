-- Follow notifications (REQ-COMMUNITY-092, 093). Still nothing stored per notification: new followers come from
-- limbus.follows, new posts from the decks and plans of the people the account follows, written after it followed them.
-- Each kind is left out while its notify_* switch (20261025041220) is off.
-- Posts are read per followed author through idx_decks_user_id / idx_md_plans_user_id.
create or replace function limbus.user_notifications(user_email text, max_rows integer default 30)
returns table (kind text, target_type text, target_id uuid, target_title text, comment_id uuid, actor_name text, actor_avatar text, excerpt text, created_at timestamptz, unread boolean)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.notifications_read_at, p.notify_comments, p.notify_follows, p.notify_posts
    from auth.users u join limbus.profiles p on p.id = u.id where u.email = user_email and not u.is_sso_user
  ), feed as (
    select case when parent.user_id = me.id then 'reply' else 'comment' end as kind, 'deck' as target_type, d.id as target_id, d.title as target_title,
      c.id as comment_id, c.user_id as actor_id, c.content, c.created_at, me.notifications_read_at
    from me
      join limbus.deck_comments c on c.user_id is distinct from me.id
      join limbus.decks d on d.id = c.deck_id
      left join limbus.deck_comments parent on parent.id = c.parent_id
    where me.notify_comments and (d.user_id = me.id or parent.user_id = me.id)
    union all
    select case when parent.user_id = me.id then 'reply' else 'comment' end, 'plan', p.id, p.title,
      c.id, c.user_id, c.content, c.created_at, me.notifications_read_at
    from me
      join limbus.md_plan_comments c on c.user_id is distinct from me.id
      join limbus.md_plans p on p.id = c.plan_id
      left join limbus.md_plan_comments parent on parent.id = c.parent_id
    where me.notify_comments and (p.user_id = me.id or parent.user_id = me.id)
    union all
    -- Someone started following the account: the row links to their profile.
    select 'follow', 'user', f.follower_id, null, f.follower_id, f.follower_id, null, f.created_at, me.notifications_read_at
    from me
      join limbus.follows f on f.following_id = me.id
      join limbus.profiles a on a.id = f.follower_id and not a.suspended
    where me.notify_follows
    union all
    -- A deck or plan by someone the account follows, posted after it followed them.
    select 'post', 'deck', d.id, d.title, d.id, d.user_id, null, d.created_at, me.notifications_read_at
    from me
      join limbus.follows f on f.follower_id = me.id
      join limbus.profiles a on a.id = f.following_id and a.public_profile and not a.suspended
      join limbus.decks d on d.user_id = f.following_id and d.created_at > f.created_at
    where me.notify_posts
    union all
    select 'post', 'plan', p.id, p.title, p.id, p.user_id, null, p.created_at, me.notifications_read_at
    from me
      join limbus.follows f on f.follower_id = me.id
      join limbus.profiles a on a.id = f.following_id and a.public_profile and not a.suspended
      join limbus.md_plans p on p.user_id = f.following_id and p.created_at > f.created_at
    where me.notify_posts
  )
  select f.kind, f.target_type, f.target_id, f.target_title, f.comment_id, a.username, a.avatar_url, left(f.content, 120), f.created_at,
    coalesce(f.created_at > f.notifications_read_at, false)
  from feed f left join limbus.profiles a on a.id = f.actor_id
  order by f.created_at desc nulls last
  limit least(greatest(coalesce(max_rows, 30), 1), 50)
$$;
revoke all on function limbus.user_notifications(text, integer) from public, anon, authenticated;
grant execute on function limbus.user_notifications(text, integer) to service_role;
