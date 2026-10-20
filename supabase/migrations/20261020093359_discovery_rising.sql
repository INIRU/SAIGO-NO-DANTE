-- REQ-COMMUNITY-075: visitors of a board's posts (or of identities) in the last days against the days before, for the
-- "지금 뜨는" shelf. Per entity of `post_kind` ('deck', 'planner' or 'identity'): distinct visitors in the latest
-- `recent_days` UTC days (today included) and in the `base_days` days before them. Entities with fewer than `min_recent`
-- recent visitors are left out; the busiest `max_rows` come back, and the app ranks them by smoothed rise.
-- Aggregates only: no visitor hash leaves the function.
-- Rollback: drop function limbus.discovery_rising(text, integer, integer, integer, integer);
create or replace function limbus.discovery_rising(post_kind text, recent_days integer default 3, base_days integer default 14, min_recent integer default 5, max_rows integer default 24)
returns table(entity_id uuid, recent bigint, base bigint) language sql stable security invoker set search_path='' as $$
with today as (select (now() at time zone 'UTC')::date as day)
select v.entity_id,
  count(distinct v.visitor_hash) filter (where v.day > today.day - recent_days) as recent,
  count(distinct v.visitor_hash) filter (where v.day <= today.day - recent_days) as base
from limbus.discovery_visits v cross join today
where v.kind = post_kind and v.day > today.day - recent_days - base_days
group by v.entity_id
having count(distinct v.visitor_hash) filter (where v.day > today.day - recent_days) >= min_recent
order by recent desc, v.entity_id
limit max_rows
$$;
revoke all on function limbus.discovery_rising(text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function limbus.discovery_rising(text, integer, integer, integer, integer) to service_role;
