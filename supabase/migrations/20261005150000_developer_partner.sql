-- Collaboration partners (e.g. the Limpi Discord bot): a tier on the account, so it survives key rotation.
-- Partner keys have no daily quota; the per-minute ceiling stays as a guard against a runaway client.
-- Rollback: drop function limbus.admin_set_partner; restore consume_developer_request from
-- 20260912103513_developer_api_and_interest.sql; alter table limbus.profiles drop column partner.
alter table limbus.profiles add column partner text check (partner in ('discord_bot'));

create or replace function limbus.consume_developer_request(token_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 return jsonb_build_object('status',200,'remaining',case when owner.partner is null then 9999-coalesce(used,0) end,'partner',owner.partner);
end $$;

-- Same actor check as admin_moderate_user; the update and its audit row commit together.
create function limbus.admin_set_partner(p_actor_email text, p_target_id uuid, p_partner text, p_admin_emails text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor limbus.profiles%rowtype; target limbus.profiles%rowtype;
begin
 select p.* into actor from limbus.profiles p join auth.users u on u.id=p.id where u.email=p_actor_email for share of p;
 if actor.id is null or (coalesce(actor.role,'user') <> 'admin' and not (p_actor_email = any(coalesce(p_admin_emails, array[]::text[]))))
   or (actor.suspended is true and (actor.suspended_until is null or actor.suspended_until > now())) then
  return jsonb_build_object('error','forbidden');
 end if;
 if p_partner is not null and p_partner <> 'discord_bot' then return jsonb_build_object('error','invalid'); end if;
 select * into target from limbus.profiles where id=p_target_id for update;
 if target.id is null then return jsonb_build_object('error','not_found'); end if;
 if target.partner is not distinct from p_partner then return jsonb_build_object('ok',true); end if;
 update limbus.profiles set partner=p_partner where id=p_target_id;
 insert into limbus.audit_logs(actor_id,action,target_type,target_id,details,severity)
 values(actor.id,'set_partner','user',p_target_id::text,jsonb_build_object('partner',p_partner,'previous_partner',target.partner),'info');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function limbus.admin_set_partner(text,uuid,text,text[]) from public,anon,authenticated;
grant execute on function limbus.admin_set_partner(text,uuid,text,text[]) to service_role;
