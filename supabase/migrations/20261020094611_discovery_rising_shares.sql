-- REQ-COMMUNITY-070: visitors of a board's posts (or of identities) in the latest days against the days before, as a
-- share of the board's traffic, for the "지금 뜨는" shelf. Replaces discovery_rising (raw counts).
-- Per entity of `post_kind` ('deck', 'planner' or 'identity'): distinct visitors in the latest `recent_days` UTC days and in
-- the `base_days` days before them, and the distinct visitors of the whole kind in each window (recent_total, base_total),
-- so the app can compare shares: site-wide traffic swings and gaps in the visit log do not move the result.
-- A day whose whole-kind visitors are fewer than `min_day_total` (a gap in the log) is left out of the entities and the totals alike.
-- Entities with fewer than `min_recent` recent visitors are left out; the busiest `max_rows` come back.
-- Aggregates only: no visitor hash leaves the function.
-- Rollback: drop function limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer);
create or replace function limbus.discovery_rising_shares(post_kind text, recent_days integer default 3, base_days integer default 14, min_day_total integer default 20, min_recent integer default 5, max_rows integer default 60)
returns table(entity_id uuid, recent bigint, base bigint, recent_total bigint, base_total bigint) language sql stable security invoker set search_path='' as $$
with today as (select (now() at time zone 'UTC')::date as day),
visits as (
  select v.visitor_hash, v.entity_id, v.day, (v.day > today.day - recent_days) as is_recent
  from limbus.discovery_visits v cross join today
  where v.kind = post_kind and v.day > today.day - recent_days - base_days
),
good_days as (select g.day from visits g group by g.day having count(distinct g.visitor_hash) >= min_day_total),
kept as (select v.visitor_hash, v.entity_id, v.is_recent from visits v join good_days g on g.day = v.day),
totals as (
  select count(distinct k.visitor_hash) filter (where k.is_recent) as recent_total,
         count(distinct k.visitor_hash) filter (where not k.is_recent) as base_total
  from kept k
)
select k.entity_id,
  count(distinct k.visitor_hash) filter (where k.is_recent) as recent,
  count(distinct k.visitor_hash) filter (where not k.is_recent) as base,
  t.recent_total, t.base_total
from kept k cross join totals t
group by k.entity_id, t.recent_total, t.base_total
having count(distinct k.visitor_hash) filter (where k.is_recent) >= min_recent
order by recent desc, k.entity_id
limit max_rows
$$;
revoke all on function limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer) to service_role;
