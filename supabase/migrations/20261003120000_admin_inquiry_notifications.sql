-- Inquiries waiting for an answer, as rows of an administrator's notification feed (REQ-COMMUNITY-017). Nothing is
-- stored: the rows are read from the support tables, in the shape of limbus.user_notifications, and share
-- profiles.notifications_read_at with the comment notifications.

-- One row per open inquiry sent by someone else: its last user message, newest first. The caller (the notifications
-- route) decides who is an administrator; this resolves the NextAuth email without creating accounts.
create or replace function limbus.admin_inquiry_notifications(user_email text, max_rows integer default 30)
returns table (kind text, target_type text, target_id uuid, target_title text, comment_id uuid, actor_name text, actor_avatar text, excerpt text, created_at timestamptz, unread boolean)
language sql stable security definer set search_path = '' as $$
  with me as (
    select p.id, p.notifications_read_at from auth.users u join limbus.profiles p on p.id = u.id where u.email = user_email and not u.is_sso_user
  )
  select 'inquiry', 'inquiry', i.id, i.title, m.id, a.username, a.avatar_url, left(m.body, 120), m.created_at, m.created_at > me.notifications_read_at
  from me
    join limbus.inquiries i on i.status = 'open' and i.user_id <> me.id
    join lateral (
      select s.id, s.body, s.created_at from limbus.support_messages s
      where s.inquiry_id = i.id and s.author_role = 'user' order by s.created_at desc limit 1
    ) m on true
    left join limbus.profiles a on a.id = i.user_id
  order by m.created_at desc
  limit least(greatest(coalesce(max_rows, 30), 1), 50)
$$;
revoke all on function limbus.admin_inquiry_notifications(text, integer) from public, anon, authenticated;
grant execute on function limbus.admin_inquiry_notifications(text, integer) to service_role;
