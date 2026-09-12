create table limbus.developer_keys (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references limbus.profiles(id) on delete cascade,
 name text not null check(length(name) between 1 and 60), key_hash text not null unique, prefix text not null,
 created_at timestamptz not null default now(), revoked_at timestamptz, last_used_at timestamptz,
 minute_start timestamptz not null default now(), minute_count integer not null default 0
);
create table limbus.developer_usage (
 key_id uuid references limbus.developer_keys(id) on delete cascade, day date not null,
 requests integer not null default 0, primary key(key_id,day)
);
create table limbus.discovery_visits (
 visitor_hash text not null, kind text not null check(kind in ('identity','deck','planner')),
 entity_id uuid not null, day date not null default (now() at time zone 'UTC')::date,
 primary key(visitor_hash,kind,entity_id,day)
);
create index discovery_visits_period_idx on limbus.discovery_visits(kind,day,entity_id);
alter table limbus.developer_keys enable row level security;
alter table limbus.developer_usage enable row level security;
alter table limbus.discovery_visits enable row level security;
revoke all on limbus.developer_keys,limbus.developer_usage,limbus.discovery_visits from anon,authenticated;
grant all on limbus.developer_keys,limbus.developer_usage,limbus.discovery_visits to service_role;
create function limbus.consume_developer_request(token_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare k limbus.developer_keys; used integer; today date := (now() at time zone 'UTC')::date;
begin
 select * into k from limbus.developer_keys where key_hash=token_hash and revoked_at is null for update;
 if not found then return jsonb_build_object('status',401); end if;
 if exists(select 1 from limbus.profiles where id=k.user_id and suspended and (suspended_until is null or suspended_until>now())) then return jsonb_build_object('status',403); end if;
 select requests into used from limbus.developer_usage where key_id=k.id and day=today;
 if coalesce(used,0)>=10000 then return jsonb_build_object('status',429,'retry',86400); end if;
 if k.minute_start>now()-interval '1 minute' and k.minute_count>=60 then return jsonb_build_object('status',429,'retry',60); end if;
 update limbus.developer_keys set last_used_at=now(),minute_count=case when minute_start<=now()-interval '1 minute' then 1 else minute_count+1 end,minute_start=case when minute_start<=now()-interval '1 minute' then now() else minute_start end where id=k.id;
 insert into limbus.developer_usage(key_id,day,requests) values(k.id,today,1) on conflict(key_id,day) do update set requests=limbus.developer_usage.requests+1;
 return jsonb_build_object('status',200,'remaining',9999-coalesce(used,0));
end $$;
create function limbus.discovery_counts(days integer default 7) returns table(kind text,entity_id uuid,visitors bigint) language sql stable security invoker set search_path='' as $$
 select v.kind,v.entity_id,count(distinct v.visitor_hash) from limbus.discovery_visits v
 where days in (0,7,30) and (days=0 or v.day >= (now() at time zone 'UTC')::date-(days-1))
 group by v.kind,v.entity_id order by count(distinct v.visitor_hash) desc
$$;
revoke all on function limbus.consume_developer_request(text),limbus.discovery_counts(integer) from public,anon,authenticated;
grant execute on function limbus.consume_developer_request(text),limbus.discovery_counts(integer) to service_role;
