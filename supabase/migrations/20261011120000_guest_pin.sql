-- REQ-COMMUNITY-029, 030: a password (four to six digits) on new guest posts, for when the browser's guest key is gone.
-- Only an HMAC of it is stored (server secret + post kind + post id + digits, lib/guest/server.ts). Five wrong tries on a
-- post lock its recovery for 24 hours; the tries are counted here because the site's request limiter lives per server instance.
-- Rollback: drop function limbus.guest_pin_recover(text, uuid, text, text); alter table limbus.guest_authorship drop column pin_hash, drop column pin_fails, drop column pin_failed_at; alter table limbus.friend_posts drop column pin_hash, drop column pin_fails, drop column pin_failed_at;

alter table limbus.guest_authorship
  add column pin_hash text check (pin_hash ~ '^[0-9a-f]{64}$'),
  -- Wrong tries since the last right one, and when the last try was made.
  add column pin_fails smallint not null default 0 check (pin_fails between 0 and 5),
  add column pin_failed_at timestamptz;

alter table limbus.friend_posts
  add column pin_hash text check (pin_hash ~ '^[0-9a-f]{64}$'),
  add column pin_fails smallint not null default 0 check (pin_fails between 0 and 5),
  add column pin_failed_at timestamptz,
  -- Only guest posts have a password.
  add check (pin_hash is null or key_hash is not null);

-- A guest proves a post is theirs with its password. p_kind: 'deck' | 'plan' (limbus.guest_authorship) or 'friend'
-- (limbus.friend_posts). Returns
--   'ok'     the password matched: the post now belongs to p_key_hash and its tries are cleared
--   'wrong'  it did not match (one try used)
--   'locked' five wrong tries, the last one less than 24 hours ago (nothing is compared)
--   'none'   no such guest post, or it has no password
-- The first statement takes a try and reads the hash at once, under the row lock, so requests sent together cannot each
-- get a try of their own. A friend post going to a key that already has one of that kind raises unique_violation.
create function limbus.guest_pin_recover(p_kind text, p_id uuid, p_pin_hash text, p_key_hash text)
returns text language plpgsql set search_path = '' as $$
declare
  tbl text := case when p_kind in ('deck', 'plan') then 'guest_authorship' when p_kind = 'friend' then 'friend_posts' end;
  col text := case p_kind when 'deck' then 'deck_id' when 'plan' then 'plan_id' else 'id' end;
  stored text;
  has_pin boolean;
begin
  if tbl is null then return 'none'; end if;
  execute format($q$
    update limbus.%I set pin_fails = case when pin_failed_at < now() - interval '24 hours' then 1 else pin_fails + 1 end, pin_failed_at = now()
    where %I = $1 and pin_hash is not null and (pin_fails < 5 or pin_failed_at < now() - interval '24 hours')
    returning pin_hash$q$, tbl, col) into stored using p_id;
  if stored is null then
    execute format('select pin_hash is not null from limbus.%I where %I = $1', tbl, col) into has_pin using p_id;
    return case when has_pin then 'locked' else 'none' end;
  end if;
  -- is distinct from: a null argument is a wrong password, not a skipped comparison.
  if stored is distinct from p_pin_hash then return 'wrong'; end if;
  execute format('update limbus.%I set key_hash = $2, pin_fails = 0, pin_failed_at = null where %I = $1', tbl, col) using p_id, p_key_hash;
  return 'ok';
end $$;
-- Called with the service role only (app/api/guest/recover/route.ts).
revoke execute on function limbus.guest_pin_recover(text, uuid, text, text) from public, anon, authenticated;
grant execute on function limbus.guest_pin_recover(text, uuid, text, text) to service_role;
