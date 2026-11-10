-- Puts back the functions dropped by migrations/20261111090000_drop_unused_functions.sql, exactly as production had them
-- on 2026-11-11 (pg_get_functiondef; each text was checked against its md5), with the same grants.

CREATE OR REPLACE FUNCTION limbus.increment_vote(deck_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  UPDATE limbus.decks SET vote_count = vote_count + 1 WHERE id = deck_id;
$function$;
revoke all on function limbus.increment_vote(uuid) from public, anon, authenticated;
grant execute on function limbus.increment_vote(uuid) to service_role;

CREATE OR REPLACE FUNCTION limbus.decrement_vote(deck_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  UPDATE limbus.decks SET vote_count = GREATEST(0, vote_count - 1) WHERE id = deck_id;
$function$;
revoke all on function limbus.decrement_vote(uuid) from public, anon, authenticated;
grant execute on function limbus.decrement_vote(uuid) to service_role;

CREATE OR REPLACE FUNCTION limbus.increment_comment(deck_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
end;
$function$;
revoke all on function limbus.increment_comment(uuid) from public, anon, authenticated;
grant execute on function limbus.increment_comment(uuid) to service_role;

CREATE OR REPLACE FUNCTION limbus.decrement_comment(deck_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
end;
$function$;
revoke all on function limbus.decrement_comment(uuid) from public, anon, authenticated;
grant execute on function limbus.decrement_comment(uuid) to service_role;

CREATE OR REPLACE FUNCTION limbus.discovery_counts(days integer DEFAULT 7)
 RETURNS TABLE(kind text, entity_id uuid, visitors bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with counts as (
select v.kind,v.entity_id,count(distinct v.visitor_hash) as visitors
from limbus.discovery_visits v
where days in (0,7,30) and (days=0 or v.day >= (now() at time zone 'UTC')::date-(days-1))
group by v.kind,v.entity_id
), ranked as (
select *,row_number() over(partition by counts.kind order by counts.visitors desc,counts.entity_id) as rank from counts
)
select ranked.kind,ranked.entity_id,ranked.visitors from ranked where rank<=12 order by ranked.visitors desc
$function$;
revoke all on function limbus.discovery_counts(integer) from public, anon, authenticated;
grant execute on function limbus.discovery_counts(integer) to service_role;

CREATE OR REPLACE FUNCTION limbus.discovery_rising(post_kind text, recent_days integer DEFAULT 3, base_days integer DEFAULT 14, min_recent integer DEFAULT 5, max_rows integer DEFAULT 24)
 RETURNS TABLE(entity_id uuid, recent bigint, base bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$;
revoke all on function limbus.discovery_rising(text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function limbus.discovery_rising(text, integer, integer, integer, integer) to service_role;

CREATE OR REPLACE FUNCTION limbus.discovery_rising_shares(post_kind text, recent_days integer DEFAULT 3, base_days integer DEFAULT 14, min_day_total integer DEFAULT 20, min_recent integer DEFAULT 5, max_rows integer DEFAULT 60)
 RETURNS TABLE(entity_id uuid, recent bigint, base bigint, recent_total bigint, base_total bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$;
revoke all on function limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function limbus.discovery_rising_shares(text, integer, integer, integer, integer, integer) to service_role;

CREATE OR REPLACE FUNCTION limbus.dedup_coin_prefix(text_in text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  lines TEXT[];
  result TEXT[];
  line TEXT;
  prev_coin TEXT := '';
  curr_coin TEXT;
  m TEXT[];
  len INT;
BEGIN
  IF text_in IS NULL OR text_in = '' THEN
    RETURN text_in;
  END IF;
  lines := string_to_array(text_in, E'\n');
  len := coalesce(array_length(lines, 1), 0);
  IF len = 0 THEN
    RETURN text_in;
  END IF;
  FOR i IN 1..len LOOP
    line := lines[i];
    m := regexp_match(line, E'^\\[코인 (\\d+)\\] (.*)$');
    IF m IS NOT NULL THEN
      curr_coin := m[1];
      IF curr_coin = prev_coin THEN
        result := array_append(result, m[2]);
      ELSE
        result := array_append(result, line);
        prev_coin := curr_coin;
      END IF;
    ELSE
      result := array_append(result, line);
      prev_coin := '';
    END IF;
  END LOOP;
  RETURN array_to_string(result, E'\n');
END;
$function$;
-- (default grants: callable by public, as before)

CREATE OR REPLACE FUNCTION limbus.reorder_skill_desc(text_in text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  all_lines TEXT[];
  pre_coin TEXT[] := '{}';
  coin_lines TEXT[] := '{}';
  pinned TEXT[] := '{}';      -- bracket lines or pinned generals before keyword
  moveables TEXT[] := '{}';   -- non-bracket non-pinned generals before keyword  
  kw_and_after TEXT[] := '{}';-- keyword line onwards (pre-coin)
  line TEXT;
  len INT;
  pc_len INT;
  first_kw INT := 0;
  in_coin BOOLEAN := FALSE;
  in_moveable BOOLEAN := FALSE;
  has_moveable BOOLEAN := FALSE;
BEGIN
  IF text_in IS NULL OR text_in = '' THEN RETURN text_in; END IF;
  all_lines := string_to_array(text_in, E'\n');
  len := coalesce(array_length(all_lines, 1), 0);
  IF len = 0 THEN RETURN text_in; END IF;
  
  -- Split pre-coin / coin
  FOR i IN 1..len LOOP
    line := all_lines[i];
    IF NOT in_coin AND line ~ E'^\\[코인 \\d+\\]' THEN in_coin := TRUE; END IF;
    IF in_coin THEN
      coin_lines := array_append(coin_lines, line);
    ELSE
      pre_coin := array_append(pre_coin, line);
    END IF;
  END LOOP;
  
  pc_len := coalesce(array_length(pre_coin, 1), 0);
  IF pc_len = 0 THEN RETURN text_in; END IF;
  
  -- Find first keyword index
  FOR i IN 1..pc_len LOOP
    IF pre_coin[i] ~ E'^\\[(사용시|전투 시작시|사용 전)\\]' THEN
      first_kw := i;
      EXIT;
    END IF;
  END LOOP;
  
  IF first_kw <= 1 THEN RETURN text_in; END IF;
  
  -- Check for moveable generals before first keyword
  FOR i IN 1..(first_kw - 1) LOOP
    line := pre_coin[i];
    IF left(line, 2) != '- ' AND left(line, 1) != '['
       AND line !~ E'^(합 가능|광역|조작 슬롯|턴 시작 시|이 스킬이 버려지면)' THEN
      has_moveable := TRUE;
      EXIT;
    END IF;
  END LOOP;
  
  IF NOT has_moveable THEN RETURN text_in; END IF;
  
  -- Separate lines before first keyword into pinned vs moveable
  in_moveable := FALSE;
  FOR i IN 1..(first_kw - 1) LOOP
    line := pre_coin[i];
    IF left(line, 2) = '- ' THEN
      -- Sub-line: follows parent category
      IF in_moveable THEN
        moveables := array_append(moveables, line);
      ELSE
        pinned := array_append(pinned, line);
      END IF;
    ELSIF left(line, 1) = '['
       OR line ~ E'^(합 가능|광역|조작 슬롯|턴 시작 시|이 스킬이 버려지면)' THEN
      -- Bracket line or pinned general → stays at top
      pinned := array_append(pinned, line);
      in_moveable := FALSE;
    ELSE
      -- Non-bracket, non-pinned general → move after keywords
      moveables := array_append(moveables, line);
      in_moveable := TRUE;
    END IF;
  END LOOP;
  
  -- Collect keyword line onwards
  FOR i IN first_kw..pc_len LOOP
    kw_and_after := array_append(kw_and_after, pre_coin[i]);
  END LOOP;
  
  RETURN array_to_string(pinned || kw_and_after || moveables || coin_lines, E'\n');
END;
$function$;
-- (default grants: callable by public, as before)
