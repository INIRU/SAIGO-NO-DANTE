-- Opt-in Assist recognition reports: per capture session, how many actions were read or held back and the gifts the user
-- added or removed by hand (labels for the samples of the same session). No user, email or IP columns.
-- Written only by /api/assist/reports with the service role; rows are removed after 180 days by that route.
create table if not exists limbus.assist_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session uuid not null,
  meta jsonb not null,
  counts jsonb not null,
  corrections jsonb not null default '[]'::jsonb
);
create index if not exists assist_reports_created_at on limbus.assist_reports(created_at);
create index if not exists assist_reports_session on limbus.assist_reports(session);
alter table limbus.assist_reports enable row level security;
revoke all on limbus.assist_reports from anon, authenticated;
grant select, insert, delete on limbus.assist_reports to service_role;
