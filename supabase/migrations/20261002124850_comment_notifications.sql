-- Comment notifications (REQ-COMMUNITY-013, 014). Nothing is stored per notification: the feed is read from the comment
-- tables, and a profile only keeps when its owner last opened the list.

-- Fail fast instead of queueing logins behind a long transaction on profiles.
set local lock_timeout = '5s';

-- Existing accounts start as "read up to now", so comments from before this feature are not unread.
alter table limbus.profiles add column if not exists notifications_read_at timestamptz not null default now();

-- Foreign keys the feed joins on (and that cascades already walk).
create index if not exists idx_decks_user_id on limbus.decks (user_id);
create index if not exists idx_md_plans_user_id on limbus.md_plans (user_id);
create index if not exists idx_deck_comments_deck_id on limbus.deck_comments (deck_id);
create index if not exists idx_md_plan_comments_plan_id on limbus.md_plan_comments (plan_id);
create index if not exists idx_md_plan_comments_parent_id on limbus.md_plan_comments (parent_id);

-- Comments by others on the account's decks and plans, and replies to its comments, newest first. A reply to the
-- account's comment on its own post is one row (a reply). Resolves the NextAuth email without creating accounts.
-- Reads the comment tables whole (tens of rows today); split into per-post and per-parent lookups if they grow large.
create or replace function limbus.user_notifications(user_email text, max_rows integer default 30)
returns table (kind text, target_type text, target_id uuid, target_title text, comment_id uuid, actor_name text, actor_avatar text, excerpt text, created_at timestamptz, unread boolean)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.notifications_read_at from auth.users u join limbus.profiles p on p.id = u.id where u.email = user_email and not u.is_sso_user
  ), feed as (
    select case when parent.user_id = me.id then 'reply' else 'comment' end as kind, 'deck' as target_type, d.id as target_id, d.title as target_title,
      c.id as comment_id, c.user_id as actor_id, c.content, c.created_at, me.notifications_read_at
    from me
      join limbus.deck_comments c on c.user_id is distinct from me.id
      join limbus.decks d on d.id = c.deck_id
      left join limbus.deck_comments parent on parent.id = c.parent_id
    where d.user_id = me.id or parent.user_id = me.id
    union all
    select case when parent.user_id = me.id then 'reply' else 'comment' end, 'plan', p.id, p.title,
      c.id, c.user_id, c.content, c.created_at, me.notifications_read_at
    from me
      join limbus.md_plan_comments c on c.user_id is distinct from me.id
      join limbus.md_plans p on p.id = c.plan_id
      left join limbus.md_plan_comments parent on parent.id = c.parent_id
    where p.user_id = me.id or parent.user_id = me.id
  )
  select f.kind, f.target_type, f.target_id, f.target_title, f.comment_id, a.username, a.avatar_url, left(f.content, 120), f.created_at,
    coalesce(f.created_at > f.notifications_read_at, false)
  from feed f left join limbus.profiles a on a.id = f.actor_id
  order by f.created_at desc nulls last
  limit least(greatest(coalesce(max_rows, 30), 1), 50)
$$;
revoke all on function limbus.user_notifications(text, integer) from public, anon, authenticated;
grant execute on function limbus.user_notifications(text, integer) to service_role;

-- The account has seen its list: everything up to now is read.
create or replace function limbus.mark_notifications_read(user_email text) returns void
language sql security definer set search_path = '' as $$
  update limbus.profiles p set notifications_read_at = now() from auth.users u where u.id = p.id and u.email = user_email and not u.is_sso_user
$$;
revoke all on function limbus.mark_notifications_read(text) from public, anon, authenticated;
grant execute on function limbus.mark_notifications_read(text) to service_role;
