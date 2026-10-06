-- Partners become rows with a code and scopes, so a partner of another kind can join later (REQ-ACCOUNT-018, REQ-ADMIN-009).
-- The Limpi Discord bot is 'limpi'. News a partner posts is kept in news_items for the calendar (REQ-NEWS-003).
-- Rollback: drop table limbus.news_items; drop function limbus.consume_developer_request(text,text[]); restore
-- consume_developer_request(text) and admin_set_partner from 20261005150000_developer_partner.sql (and its grants from
-- 20260912103513_developer_api_and_interest.sql); alter table limbus.profiles drop constraint profiles_partner_fkey;
-- update limbus.profiles set partner='discord_bot' where partner='limpi';
-- alter table limbus.profiles add constraint profiles_partner_check check (partner in ('discord_bot')); drop table limbus.partners.

-- Fail fast instead of queueing logins behind a long transaction on profiles.
set local lock_timeout = '5s';

-- Read and written with the service role only: RLS is on with no policies.
create table limbus.partners (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table limbus.partners enable row level security;
revoke all on limbus.partners from anon, authenticated;
insert into limbus.partners(code, name, scopes) values ('limpi', '림피', array['catalog:read', 'news:write']);

alter table limbus.profiles drop constraint profiles_partner_check;
update limbus.profiles set partner = 'limpi' where partner = 'discord_bot';
alter table limbus.profiles add constraint profiles_partner_fkey foreign key (partner) references limbus.partners(code) on update cascade;
create index idx_profiles_partner on limbus.profiles (partner) where partner is not null;

-- As before, plus what the key may do: the partner's scopes, and whether the owner is an administrator (role, or an
-- address in ADMIN_EMAILS passed by the route). Administrators may read every resource and dry-run writes, to check the
-- developer tools. Definer because the email lives in auth.users; only the service role may execute it.
drop function limbus.consume_developer_request(text);
create function limbus.consume_developer_request(token_hash text, p_admin_emails text[] default array[]::text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare k limbus.developer_keys; owner limbus.profiles; used integer; today date := (now() at time zone 'UTC')::date; per_minute integer;
begin
 select * into k from limbus.developer_keys where key_hash=token_hash and revoked_at is null for update;
 if not found then return jsonb_build_object('status',401); end if;
 select * into owner from limbus.profiles where id=k.user_id;
 if owner.suspended and (owner.suspended_until is null or owner.suspended_until>now()) then return jsonb_build_object('status',403); end if;
 per_minute := case when owner.partner is null then 60 else 600 end;
 select requests into used from limbus.developer_usage where key_id=k.id and day=today;
 if owner.partner is null and coalesce(used,0)>=10000 then return jsonb_build_object('status',429,'retry',86400); end if;
 if k.minute_start>now()-interval '1 minute' and k.minute_count>=per_minute then return jsonb_build_object('status',429,'retry',60); end if;
 update limbus.developer_keys set last_used_at=now(),minute_count=case when minute_start<=now()-interval '1 minute' then 1 else minute_count+1 end,minute_start=case when minute_start<=now()-interval '1 minute' then now() else minute_start end where id=k.id;
 insert into limbus.developer_usage(key_id,day,requests) values(k.id,today,1) on conflict(key_id,day) do update set requests=limbus.developer_usage.requests+1;
 return jsonb_build_object('status',200,'remaining',case when owner.partner is null then 9999-coalesce(used,0) end,'partner',owner.partner,
  'scopes',coalesce((select to_jsonb(p.scopes) from limbus.partners p where p.code=owner.partner),'[]'::jsonb),
  'admin',coalesce(owner.role,'user')='admin' or exists(select 1 from auth.users u where u.id=owner.id and u.email=any(coalesce(p_admin_emails,array[]::text[]))));
end $$;
revoke all on function limbus.consume_developer_request(text,text[]) from public,anon,authenticated;
grant execute on function limbus.consume_developer_request(text,text[]) to service_role;

-- As before, but any registered partner code is accepted.
create or replace function limbus.admin_set_partner(p_actor_email text, p_target_id uuid, p_partner text, p_admin_emails text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor limbus.profiles%rowtype; target limbus.profiles%rowtype;
begin
 select p.* into actor from limbus.profiles p join auth.users u on u.id=p.id where u.email=p_actor_email for share of p;
 if actor.id is null or (coalesce(actor.role,'user') <> 'admin' and not (p_actor_email = any(coalesce(p_admin_emails, array[]::text[]))))
   or (actor.suspended is true and (actor.suspended_until is null or actor.suspended_until > now())) then
  return jsonb_build_object('error','forbidden');
 end if;
 if p_partner is not null and not exists(select 1 from limbus.partners where code=p_partner) then return jsonb_build_object('error','invalid'); end if;
 select * into target from limbus.profiles where id=p_target_id for update;
 if target.id is null then return jsonb_build_object('error','not_found'); end if;
 if target.partner is not distinct from p_partner then return jsonb_build_object('ok',true); end if;
 update limbus.profiles set partner=p_partner where id=p_target_id;
 insert into limbus.audit_logs(actor_id,action,target_type,target_id,details,severity)
 values(actor.id,'set_partner','user',p_target_id::text,jsonb_build_object('partner',p_partner,'previous_partner',target.partner),'info');
 return jsonb_build_object('ok',true);
end $$;

-- One row per item a partner posted. external_id is the partner's own id: posting it again replaces the row.
-- feed, platform, category and the shape of author/content are validated by the API (lib/news/payload.ts), the only writer.
create table limbus.news_items (
  id uuid primary key default gen_random_uuid(),
  partner text not null references limbus.partners(code) on update cascade,
  external_id text not null check (char_length(external_id) between 1 and 120),
  feed text not null,
  platform text not null,
  category text not null default 'notice',
  published_at timestamptz not null,
  starts_at timestamptz,
  ends_at timestamptz,
  spoiler boolean not null default false,
  author jsonb,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner, external_id)
);
create index idx_news_items_published_at on limbus.news_items (published_at desc);
alter table limbus.news_items enable row level security;
revoke all on limbus.news_items from anon, authenticated;
