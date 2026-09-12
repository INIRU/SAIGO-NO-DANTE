-- Run only when reverting the corresponding restoration release.
begin;
set local lock_timeout = '5s';
alter table limbus.ego add column if not exists ego_skills jsonb;
alter table limbus.ego add column if not exists ego_cor_skills jsonb;
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'ai_summaries', 'identity_ai_summaries', 'ai_tier_ratings',
    'tier_list', 'tier_ratings', 'tier_rating_reports', 'identity_sentiment',
    'official_news_events', 'story_lines', 'story_episodes', 'story_characters'
  ] loop
    if to_regclass(format('limbus_retired.%I', table_name)) is not null then
      execute format('alter table limbus_retired.%I set schema limbus', table_name);
    end if;
  end loop;
  if to_regclass('limbus_retired.identity_sentiment_trend') is not null then
    alter view limbus_retired.identity_sentiment_trend set schema limbus;
  end if;
  if to_regprocedure('limbus_retired.upsert_ai_summary(text,text,character varying,text,text,uuid)') is not null then
    alter function limbus_retired.upsert_ai_summary(text,text,character varying,text,text,uuid) set schema limbus;
  end if;
end $$;
commit;
