-- Derived game text only. Source gift/event/choice rows are never changed by this migration.
create table limbus.assist_text_embeddings (
  model_id text not null,
  model_revision text not null,
  preprocess_version text not null,
  entity_kind text not null check (entity_kind in ('gift', 'event', 'choice')),
  entity_id integer not null check (entity_id > 0),
  locale text not null check (locale in ('ko', 'en', 'ja')),
  field_name text not null,
  chunk_index integer not null check (chunk_index >= 0),
  token_start integer not null check (token_start >= 0),
  token_end integer not null check (token_end > token_start),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  content text not null check (length(trim(content)) > 0),
  embedding public.vector(384) not null,
  updated_at timestamptz not null default now(),
  primary key (model_id, model_revision, preprocess_version, entity_kind, entity_id, locale, field_name, chunk_index),
  constraint assist_text_field_kind_check check (
    (entity_kind = 'gift' and field_name in ('name', 'effect_base', 'effect_plus', 'effect_plusplus')) or
    (entity_kind = 'event' and field_name in ('name', 'desc_text')) or
    (entity_kind = 'choice' and field_name in ('message', 'message_desc', 'result_text'))
  )
);

create index assist_text_embeddings_filter_idx
  on limbus.assist_text_embeddings (model_revision, preprocess_version, locale, entity_kind);

alter table limbus.assist_text_embeddings enable row level security;
revoke all on limbus.assist_text_embeddings from public, anon, authenticated;
grant select, insert, update, delete on limbus.assist_text_embeddings to service_role;

-- Exact cosine scan is sufficient at the current catalog size. The server alone may call it.
create function limbus.match_assist_text_embeddings(
  query_embedding public.vector,
  query_locale text,
  query_model_id text,
  query_model_revision text,
  query_preprocess_version text,
  query_entity_kind text default null,
  match_count integer default 8
)
returns table (
  entity_kind text,
  entity_id integer,
  locale text,
  field_name text,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql stable security invoker
set search_path = ''
as $$
  select e.entity_kind, e.entity_id, e.locale, e.field_name, e.chunk_index, e.content,
    (1 - (e.embedding operator(public.<=>) query_embedding))::double precision as similarity
  from limbus.assist_text_embeddings as e
  where e.locale = query_locale
    and e.model_id = query_model_id
    and e.model_revision = query_model_revision
    and e.preprocess_version = query_preprocess_version
    and (query_entity_kind is null or e.entity_kind = query_entity_kind)
    and query_locale in ('ko', 'en', 'ja')
    and (query_entity_kind is null or query_entity_kind in ('gift', 'event', 'choice'))
    and public.vector_dims(query_embedding) = 384
    and public.vector_norm(query_embedding) > 0
  order by e.embedding operator(public.<=>) query_embedding
  limit least(greatest(coalesce(match_count, 8), 1), 20);
$$;

revoke all on function limbus.match_assist_text_embeddings(public.vector, text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function limbus.match_assist_text_embeddings(public.vector, text, text, text, text, text, integer)
  to service_role;
