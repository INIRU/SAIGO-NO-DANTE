-- REQ-COMMUNITY-072: posts that the same visitors looked at, for the "함께 본 글" lane on deck and plan details.
-- Counts distinct visitors of `entity` who also visited another post of the same kind (post_kind: 'deck' or 'planner')
-- since the boundary day (null = all time). A post needs at least 3 shared visitors and more than the count a pair of
-- unrelated posts would share (target visitors x other visitors / all visitors of the kind); rows are ranked by
-- shared / (expected + 1), so a post everyone visits does not top every list. Aggregates only: no visitor hash leaves the function.
-- Rollback: drop function limbus.discovery_covisited(uuid, text, date, integer);
create or replace function limbus.discovery_covisited(entity uuid, post_kind text, since date default null, max_rows integer default 12)
returns table(entity_id uuid, covisitors bigint, visitors bigint) language sql stable security invoker set search_path='' as $$
with seen as (
  select distinct v.visitor_hash, v.entity_id from limbus.discovery_visits v
  where v.kind = post_kind and (since is null or v.day >= since)
), mine as (
  select visitor_hash from seen where seen.entity_id = entity
), totals as (
  select (select count(*) from mine) as target, (select count(distinct visitor_hash) from seen) as everyone
), others as (
  select s.entity_id, count(*) as visitors, count(*) filter (where s.visitor_hash in (select visitor_hash from mine)) as shared
  from seen s where s.entity_id <> entity group by s.entity_id
)
select o.entity_id, o.shared, o.visitors
from others o cross join totals t
where o.shared >= 3 and o.shared > t.target * o.visitors::numeric / t.everyone
order by o.shared / (t.target * o.visitors::numeric / t.everyone + 1) desc, o.shared desc, o.entity_id
limit max_rows
$$;
revoke all on function limbus.discovery_covisited(uuid, text, date, integer) from public, anon, authenticated;
grant execute on function limbus.discovery_covisited(uuid, text, date, integer) to service_role;
