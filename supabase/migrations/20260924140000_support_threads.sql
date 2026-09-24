-- Threaded support: the question, every answer and every follow-up is one message.
-- Additive: inquiries.content/reply stay (reply mirrors the latest admin answer for the contribution review).
alter table limbus.inquiries
  add column if not exists closed_at timestamptz,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_admin_message_at timestamptz,
  add column if not exists user_last_read_at timestamptz;

create table if not exists limbus.support_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references limbus.inquiries(id) on delete cascade,
  author_role text not null check (author_role in ('user','admin')),
  author_id uuid references limbus.profiles(id),
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_inquiry_created on limbus.support_messages(inquiry_id, created_at);
alter table limbus.support_messages enable row level security;
-- NextAuth sessions are checked by server routes; there is no Supabase user JWT.
revoke all on limbus.support_messages from anon, authenticated;
grant select, insert, update, delete on limbus.support_messages to service_role;

-- A follow-up reopens an accepted data contribution; the award depends on the review reply, not the current status.
alter table limbus.inquiries drop constraint if exists inquiry_contribution_review;
alter table limbus.inquiries add constraint inquiry_contribution_review check (
  not contribution_accepted or (category='data' and length(trim(reply))>0 and replied_by is not null)
);

insert into limbus.support_messages (inquiry_id, author_role, author_id, body, created_at)
select i.id, 'user', i.user_id, i.content, i.created_at from limbus.inquiries i
where not exists (select 1 from limbus.support_messages m where m.inquiry_id = i.id and m.author_role = 'user');
insert into limbus.support_messages (inquiry_id, author_role, author_id, body, created_at)
select i.id, 'admin', i.replied_by, i.reply, coalesce(i.replied_at, i.updated_at) from limbus.inquiries i
where length(trim(i.reply)) > 0
  and not exists (select 1 from limbus.support_messages m where m.inquiry_id = i.id and m.author_role = 'admin');

-- Closed threads start read; answered-but-open threads show the unread dot once.
update limbus.inquiries i set
  last_message_at = (select max(m.created_at) from limbus.support_messages m where m.inquiry_id = i.id),
  last_admin_message_at = (select max(m.created_at) from limbus.support_messages m where m.inquiry_id = i.id and m.author_role = 'admin'),
  closed_at = case when i.status = 'closed' then i.updated_at end,
  user_last_read_at = case when i.status = 'closed' then now() end
where i.last_message_at is null;

-- Navbar badge: resolves the NextAuth email without creating accounts.
create or replace function limbus.support_unread(user_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from limbus.inquiries i join auth.users u on u.id = i.user_id
    where u.email = user_email and i.last_admin_message_at is not null
      and (i.user_last_read_at is null or i.last_admin_message_at > i.user_last_read_at)
  )
$$;
revoke all on function limbus.support_unread(text) from public, anon, authenticated;
grant execute on function limbus.support_unread(text) to service_role;
