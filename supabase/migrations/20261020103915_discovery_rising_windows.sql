-- REQ-COMMUNITY-078: like discovery_rising_shares, over a longer window (7 days against the 21 before), and a gap in the
-- visit log is found by comparison, not by a fixed number: a UTC day whose distinct visitors of the kind are fewer than
-- `gap_ratio` (default 40%) of the median of the other days' in the window is left out of the entities and the totals alike.
-- Per entity of `post_kind` ('deck', 'planner' or 'identity'): distinct visitors in the latest `recent_days` UTC days and in
-- the `base_days` days before them, and the distinct visitors of the whole kind in each window (recent_total, base_total).
-- Every entity with a visit in the kept days comes back (the busiest `max_rows`); the app sets its own evidence floors.
-- Aggregates only: no visitor hash leaves the function.
-- Rollback: drop function limbus.discovery_rising_windows(text, integer, integer, numeric, integer);
create or replace function limbus.discovery_rising_windows(post_kind text, recent_days integer default 7, base_days integer default 21, gap_ratio numeric default 0.4, max_rows integer default 3000)
returns table(entity_id uuid, recent bigint, base bigint, recent_total bigint, base_total bigint) language sql stable security invoker set search_path='' as $$
with today as (select (now() at time zone 'UTC')::date as day),
visits as (
  select v.visitor_hash, v.entity_id, v.day, (v.day > today.day - recent_days) as is_recent
  from limbus.discovery_visits v cross join today
  where v.kind = post_kind and v.day > today.day - recent_days - base_days
),
day_totals as (select v.day, count(distinct v.visitor_hash) as n from visits v group by v.day),
good_days as (
  select d.day from day_totals d
  where d.n >= gap_ratio * coalesce((select percentile_cont(0.5) within group (order by o.n) from day_totals o where o.day <> d.day), 0)
),
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
order by recent desc, k.entity_id
limit max_rows
$$;
revoke all on function limbus.discovery_rising_windows(text, integer, integer, numeric, integer) from public, anon, authenticated;
grant execute on function limbus.discovery_rising_windows(text, integer, integer, numeric, integer) to service_role;
