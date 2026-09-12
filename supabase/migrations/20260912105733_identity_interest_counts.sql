create index discovery_visits_identity_idx on limbus.discovery_visits(kind, entity_id, day);
create function limbus.identity_interest(identity_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
'week',count(distinct visitor_hash) filter(where day >= (now() at time zone 'UTC')::date-6),
'month',count(distinct visitor_hash) filter(where day >= (now() at time zone 'UTC')::date-29),
'all',count(distinct visitor_hash))
from limbus.discovery_visits where kind='identity' and entity_id=identity_id
$$;
revoke all on function limbus.identity_interest(uuid) from public,anon,authenticated;
grant execute on function limbus.identity_interest(uuid) to service_role;
create or replace function limbus.discovery_counts(days integer default 7) returns table(kind text,entity_id uuid,visitors bigint) language sql stable security invoker set search_path='' as $$
with counts as (
select v.kind,v.entity_id,count(distinct v.visitor_hash) as visitors
from limbus.discovery_visits v
where days in (0,7,30) and (days=0 or v.day >= (now() at time zone 'UTC')::date-(days-1))
group by v.kind,v.entity_id
), ranked as (
select *,row_number() over(partition by counts.kind order by counts.visitors desc,counts.entity_id) as rank from counts
)
select ranked.kind,ranked.entity_id,ranked.visitors from ranked where rank<=12 order by ranked.visitors desc
$$;
