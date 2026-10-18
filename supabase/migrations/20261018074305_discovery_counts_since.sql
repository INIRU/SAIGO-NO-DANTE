-- Popular windows follow the game's update week (Thursday 12:00 KST); the app computes the boundary day
-- (lib/discovery/update-window.ts) and passes it in. null = all time.
create or replace function limbus.discovery_counts_since(since date default null) returns table(kind text,entity_id uuid,visitors bigint) language sql stable security invoker set search_path='' as $$
with counts as (
select v.kind,v.entity_id,count(distinct v.visitor_hash) as visitors
from limbus.discovery_visits v
where since is null or v.day >= since
group by v.kind,v.entity_id
), ranked as (
select *,row_number() over(partition by counts.kind order by counts.visitors desc,counts.entity_id) as rank from counts
)
select ranked.kind,ranked.entity_id,ranked.visitors from ranked where rank<=12 order by ranked.visitors desc
$$;
revoke all on function limbus.discovery_counts_since(date) from public,anon,authenticated;
grant execute on function limbus.discovery_counts_since(date) to service_role;
