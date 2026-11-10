-- 덱 추천·댓글 수·덱 수정을 DB 함수 하나(한 트랜잭션)로 처리한다.
-- 새 함수는 사이트가 서비스 키로만 부른다(20260928232000_service_only_functions.sql과 같은 관례).

-- 1. 덱 추천 토글: 추천 행과 추천 수를 같이 바꾼다. true = 추천됨, false = 취소됨.
create or replace function limbus.toggle_deck_vote(p_deck_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from limbus.deck_votes where deck_id = p_deck_id and user_id = p_user_id;
  get diagnostics n = row_count;
  if n > 0 then
    update limbus.decks set vote_count = greatest(0, vote_count - 1) where id = p_deck_id;
    return false;
  end if;

  insert into limbus.deck_votes (deck_id, user_id) values (p_deck_id, p_user_id) on conflict do nothing;
  get diagnostics n = row_count;
  -- 동시에 같은 사용자가 눌러 이미 들어가 있으면 수는 이미 올라갔다.
  if n > 0 then
    update limbus.decks set vote_count = vote_count + 1 where id = p_deck_id;
  end if;
  return true;
end;
$$;

-- 2. 댓글 수는 트리거가 맞춘다. 연쇄로 지워진 답글도 한 줄씩 불린다. 부모 글이 이미 지워졌으면 0행 갱신이다.
create or replace function limbus.sync_deck_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update limbus.decks set comment_count = coalesce(comment_count, 0) + 1 where id = new.deck_id;
    return new;
  end if;
  update limbus.decks set comment_count = greatest(0, coalesce(comment_count, 0) - 1) where id = old.deck_id;
  return old;
end;
$$;

create or replace function limbus.sync_plan_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update limbus.md_plans set comment_count = coalesce(comment_count, 0) + 1 where id = new.plan_id;
    return new;
  end if;
  update limbus.md_plans set comment_count = greatest(0, coalesce(comment_count, 0) - 1) where id = old.plan_id;
  return old;
end;
$$;

drop trigger if exists deck_comments_sync_count on limbus.deck_comments;
create trigger deck_comments_sync_count
  after insert or delete on limbus.deck_comments
  for each row execute function limbus.sync_deck_comment_count();

drop trigger if exists md_plan_comments_sync_count on limbus.md_plan_comments;
create trigger md_plan_comments_sync_count
  after insert or delete on limbus.md_plan_comments
  for each row execute function limbus.sync_plan_comment_count();

-- 3. 옛 함수는 아무 일도 하지 않게 둔다: 배포 전의 옛 코드가 불러도 트리거와 겹쳐 두 번 세지 않게.
-- 새 코드가 운영에 올라간 뒤 없앤다.
create or replace function limbus.increment_comment(deck_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
end;
$$;

create or replace function limbus.decrement_comment(deck_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
end;
$$;

-- 4. 덱 수정: 덱 칸 수정과 인격·E.G.O 행 교체를 한 트랜잭션으로. p_patch는 키가 있을 때만 그 칸을 바꾼다.
-- p_patch 키: title, description, tags, main_keywords, content_type, content_edited_at.
create or replace function limbus.replace_deck(p_deck_id uuid, p_patch jsonb, p_identities jsonb, p_egos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update limbus.decks set
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    tags = case when p_patch ? 'tags'
      then coalesce(array(select jsonb_array_elements_text(p_patch->'tags')), '{}'::text[]) else tags end,
    main_keywords = case when p_patch ? 'main_keywords'
      then coalesce(array(select jsonb_array_elements_text(p_patch->'main_keywords')), '{}'::text[]) else main_keywords end,
    content_type = case when p_patch ? 'content_type' then p_patch->>'content_type' else content_type end,
    content_edited_at = case when p_patch ? 'content_edited_at' then (p_patch->>'content_edited_at')::timestamptz else content_edited_at end
  where id = p_deck_id;
  if not found then
    raise exception 'deck % not found', p_deck_id;
  end if;

  delete from limbus.deck_identities where deck_id = p_deck_id;
  insert into limbus.deck_identities (deck_id, identity_id, slot_order, gacksung, s1_count, s2_count, s3_count, uptie)
  select p_deck_id, r.identity_id, r.slot_order, r.gacksung, r.s1_count, r.s2_count, r.s3_count, r.uptie
  from jsonb_to_recordset(coalesce(p_identities, '[]'::jsonb)) as r(
    identity_id uuid, slot_order integer, gacksung boolean, s1_count integer, s2_count integer, s3_count integer, uptie smallint
  );

  delete from limbus.deck_egos where deck_id = p_deck_id;
  insert into limbus.deck_egos (deck_id, ego_id, grade)
  select p_deck_id, r.ego_id, r.grade
  from jsonb_to_recordset(coalesce(p_egos, '[]'::jsonb)) as r(ego_id uuid, grade text);
end;
$$;

-- 실행 권한: public·anon·authenticated에서 거두고 service_role에만 준다.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'limbus' and p.proname in ('toggle_deck_vote', 'replace_deck', 'sync_deck_comment_count',
      'sync_plan_comment_count', 'increment_comment', 'decrement_comment')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
