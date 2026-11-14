-- Run against a configured database; every fixture is rolled back.
begin;
do $$
declare
  uid uuid := gen_random_uuid();
  v_other_deck uuid;
  v_deck uuid;
  v_plan uuid;
  v_inquiry uuid;
  v_comment uuid;
begin
  assert not has_function_privilege('anon', 'limbus.delete_user_account(uuid)', 'execute'), 'anon cannot delete accounts';
  assert not has_function_privilege('authenticated', 'limbus.delete_user_account(uuid)', 'execute'), 'signed-in clients cannot call it directly';
  assert has_function_privilege('service_role', 'limbus.delete_user_account(uuid)', 'execute');

  insert into auth.users(id, email) values (uid, 'delete-test-' || uid || '@example.invalid');
  insert into limbus.profiles(id) values (uid) on conflict (id) do nothing;

  insert into limbus.decks(user_id, title) values (uid, 'delete test deck') returning id into v_deck;
  insert into limbus.md_plans(user_id, title) values (uid, 'delete test plan') returning id into v_plan;
  select id into v_other_deck from limbus.decks where user_id is distinct from uid limit 1;
  assert v_other_deck is not null, 'Another deck is needed for the comment test';
  insert into limbus.deck_comments(deck_id, user_id, content) values (v_other_deck, uid, 'delete test comment') returning id into v_comment;
  insert into limbus.deck_votes(deck_id, user_id) values (v_other_deck, uid);
  insert into limbus.inquiries(user_id, category, title, content) values (uid, 'other', 'delete test', 'delete test') returning id into v_inquiry;
  insert into limbus.support_messages(inquiry_id, author_id, author_role, body) values (v_inquiry, uid, 'user', 'delete test');

  perform limbus.delete_user_account(uid);

  assert not exists (select 1 from limbus.profiles where id = uid), 'profile removed';
  assert not exists (select 1 from limbus.decks where id = v_deck), 'own deck removed, not left without an author';
  assert not exists (select 1 from limbus.md_plans where id = v_plan), 'own plan removed';
  assert not exists (select 1 from limbus.deck_comments where id = v_comment), 'comment on another deck removed';
  assert not exists (select 1 from limbus.deck_votes where user_id = uid), 'votes go with the profile';
  assert not exists (select 1 from limbus.inquiries where id = v_inquiry), 'own inquiry removed';
  assert not exists (select 1 from limbus.support_messages where inquiry_id = v_inquiry), 'its messages removed';
  assert exists (select 1 from limbus.decks where id = v_other_deck), 'other people''s decks stay';
  -- The route deletes the auth user afterwards; nothing in limbus blocks it any more.
  delete from auth.users where id = uid;
end $$;
rollback;
