-- Machine translations of user posts (decks, plans), one row per post and target language.
-- source_hash changes when the post is edited, so stale rows are retranslated. Written and read by the server only.
create table limbus.post_translations (
  kind text not null check (kind in ('deck', 'plan')),
  post_id uuid not null,
  lang text not null check (lang in ('ko', 'en', 'ja')),
  source_hash text not null,
  pairs jsonb not null,
  created_at timestamptz not null default now(),
  primary key (kind, post_id, lang)
);
alter table limbus.post_translations enable row level security;
revoke all on limbus.post_translations from anon, authenticated;
