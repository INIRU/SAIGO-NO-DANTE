-- Existing announcements remain published; new drafts are explicit API writes.
alter table limbus.announcements
  add column if not exists lang text not null default 'ko' check (lang in ('ko','en','ja')),
  add column if not exists published boolean not null default true,
  add column if not exists content_doc jsonb;
create table limbus.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references limbus.profiles(id),
  category text not null check (category in ('bug','data','account','suggestion','other')),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 10000),
  status text not null default 'open' check (status in ('open','answered','closed')),
  reply text not null default '' check (char_length(reply) <= 10000),
  replied_by uuid references limbus.profiles(id),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inquiries_user_created on limbus.inquiries(user_id, created_at desc);
create index inquiries_status_created on limbus.inquiries(status, created_at desc);
alter table limbus.inquiries enable row level security;
-- NextAuth sessions are checked by server routes; there is no Supabase user JWT.
revoke all on limbus.inquiries from anon, authenticated;
grant select, insert, update, delete on limbus.inquiries to service_role;
-- Public announcement reads use a server query that explicitly excludes drafts.
alter table limbus.announcements enable row level security;
revoke all on limbus.announcements from anon, authenticated;
grant select, insert, update, delete on limbus.announcements to service_role;
