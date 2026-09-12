-- Retire removed features while retaining their schema/data for a direct rollback.
-- Apply with the restoration release. No unrelated bot tables or backups are touched.
begin;
set local lock_timeout = '5s';

create schema if not exists limbus_retired;
revoke all on schema limbus_retired from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ai_summaries', 'identity_ai_summaries', 'ai_tier_ratings',
    'tier_list', 'tier_ratings', 'tier_rating_reports', 'identity_sentiment',
    'official_news_events', 'story_lines', 'story_episodes', 'story_characters'
  ] loop
    if to_regclass(format('limbus.%I', table_name)) is not null then
      execute format('alter table limbus.%I set schema limbus_retired', table_name);
    end if;
  end loop;
  if to_regclass('limbus.identity_sentiment_trend') is not null then
    alter view limbus.identity_sentiment_trend set schema limbus_retired;
  end if;
  if to_regprocedure('limbus.upsert_ai_summary(text,text,character varying,text,text,uuid)') is not null then
    alter function limbus.upsert_ai_summary(text,text,character varying,text,text,uuid) set schema limbus_retired;
  end if;
end $$;

-- ego_skills is normalized already. Refuse to discard legacy values from any
-- environment that has not yet reconciled them against the relational table.
do $$
declare
  legacy_column text;
  has_legacy_values boolean;
begin
  foreach legacy_column in array array['ego_skills', 'ego_cor_skills'] loop
    if exists (select 1 from information_schema.columns
      where table_schema='limbus' and table_name='ego' and column_name=legacy_column) then
      lock table limbus.ego in access exclusive mode;
      execute format('select exists(select 1 from limbus.ego where %I is not null)', legacy_column)
        into has_legacy_values;
      if has_legacy_values then
        raise exception 'Reconcile and back up ego.% before removing it', legacy_column;
      end if;
      execute format('alter table limbus.ego drop column %I', legacy_column);
    end if;
  end loop;
end $$;

commit;
