alter table limbus.decks
  add column if not exists main_keywords text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'decks_main_keywords_valid'
      and conrelid = 'limbus.decks'::regclass
  ) then
    alter table limbus.decks
      add constraint decks_main_keywords_valid
      check (
        cardinality(main_keywords) <= 5
        and array_position(main_keywords, null) is null
        and main_keywords <@ array['참격', '관통', '타격', '화상', '파열', '침잠', '호흡', '진동', '충전', '출혈']::text[]
      );
  end if;
end $$;

create index if not exists decks_main_keywords_gin_idx
  on limbus.decks using gin (main_keywords);

comment on column limbus.decks.main_keywords is
  'User-selected permanent/main deck keywords. At most 5 values from the pinned deck keyword set; default backfill uses formation slots 1-7 only.';

with formation_identities as (
  select
    di.deck_id,
    di.identity_id
  from limbus.deck_identities di
  where coalesce(di.slot_order, 99) between 0 and 6
),
status_keywords as (
  select distinct
    fi.deck_id,
    fi.identity_id,
    case
      when raw_keyword.keyword in (
        '사랑/증오', '깊은 눈물', '적안', '적안적안 - 경계적안 - 포식',
        '참회', '참회참회 - 경계참회 - 고해', '생체 재료',
        '충전 횟수', '충전 역장', '부하', '과충전', '자가 충전', '전하침',
        '광전', '고전압 외피', '초아광축전'
      ) then '충전'
      else raw_keyword.keyword
    end as keyword
  from formation_identities fi
  join limbus.identities i on i.id = fi.identity_id
  cross join lateral unnest(i.skill_keyword_list) as raw_keyword(keyword)
),
identity_keywords as (
  select deck_id, identity_id, keyword
  from status_keywords
  where keyword in ('화상', '파열', '침잠', '호흡', '진동', '충전', '출혈')
),
formation_counts as (
  select deck_id, count(distinct identity_id) as formation_count
  from formation_identities
  group by deck_id
),
keyword_counts as (
  select deck_id, keyword, count(*) as keyword_count
  from identity_keywords
  group by deck_id, keyword
),
eligible_keywords as (
  select
    kc.deck_id,
    kc.keyword,
    kc.keyword_count,
    array_position(
      array['참격', '관통', '타격', '화상', '파열', '침잠', '호흡', '진동', '충전', '출혈']::text[],
      kc.keyword
    ) as keyword_order
  from keyword_counts kc
  join formation_counts fc on fc.deck_id = kc.deck_id
  where kc.keyword_count >= case
    when fc.formation_count <= 1 then 1
    else greatest(2, ceil(fc.formation_count * 0.4)::integer)
  end
),
ranked_keywords as (
  select
    deck_id,
    keyword,
    row_number() over (
      partition by deck_id
      order by keyword_count desc, keyword_order asc
    ) as keyword_rank
  from eligible_keywords
),
backfilled_keywords as (
  select deck_id, array_agg(keyword order by keyword_rank) as main_keywords
  from ranked_keywords
  where keyword_rank <= 5
  group by deck_id
)
update limbus.decks d
set main_keywords = coalesce(bk.main_keywords, '{}'::text[])
from formation_counts fc
left join backfilled_keywords bk on bk.deck_id = fc.deck_id
where d.id = fc.deck_id
  and cardinality(d.main_keywords) = 0;
