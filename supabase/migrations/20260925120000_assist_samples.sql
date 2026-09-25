-- Opt-in Assist recognition samples (frames around uncertain reads) for retraining. No user, email or IP columns.
-- Written only by /api/assist/samples with the service role; rows and files are removed after 180 days by that route.
create table if not exists limbus.assist_samples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reason text not null,
  meta jsonb not null,
  frame_count smallint not null check (frame_count between 1 and 10),
  path text not null
);
create index if not exists assist_samples_created_at on limbus.assist_samples(created_at);
alter table limbus.assist_samples enable row level security;
revoke all on limbus.assist_samples from anon, authenticated;
grant select, insert, delete on limbus.assist_samples to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assist-samples', 'assist-samples', false, 409600, array['image/jpeg'])
on conflict (id) do nothing;
