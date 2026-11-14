-- Run against a configured development database; every fixture is rolled back.
begin;
do $$
declare post_id uuid; deck uuid; pin text := repeat('1', 64); bad text := repeat('2', 64); old_key text := repeat('a', 64); new_key text := repeat('b', 64);
begin
  assert not has_function_privilege('anon', 'limbus.guest_pin_recover(text, uuid, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'limbus.guest_pin_recover(text, uuid, text, text)', 'execute'), 'the function is service-role only';
  assert has_function_privilege('service_role', 'limbus.guest_pin_recover(text, uuid, text, text)', 'execute')
    and has_table_privilege('service_role', 'limbus.guest_authorship', 'update') and has_table_privilege('service_role', 'limbus.friend_posts', 'update'), 'the service role runs it and may change both tables';

  -- A guest's friend post with a password: the hash only, and never on a signed-in post.
  insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag, pin_hash) values('support', 'P482593721', array['10613'], old_key, 'aaaa', pin) returning id into post_id;
  begin update limbus.friend_posts set pin_hash = '482100' where id = post_id; assert false, 'digits are not stored';
  exception when check_violation then null; end;
  begin update limbus.friend_posts set pin_fails = 6 where id = post_id; assert false, 'at most five tries are counted';
  exception when check_violation then null; end;
  begin insert into limbus.friend_posts(kind, code, identity_ids, user_id, pin_hash) select 'support', 'F185652736', array['10212'], id, pin from limbus.profiles limit 1; assert not found, 'a signed-in post has no password';
  exception when check_violation then null; end;

  -- No hash is a wrong password, not a pass.
  assert limbus.guest_pin_recover('friend', post_id, null, new_key) = 'wrong';
  assert (select key_hash = old_key from limbus.friend_posts where id = post_id), 'a null hash takes nothing';
  update limbus.friend_posts set pin_fails = 0, pin_failed_at = null where id = post_id;

  -- A wrong try is counted; the right password hands the post to the new key and clears the count. The tag stays.
  assert limbus.guest_pin_recover('friend', post_id, bad, new_key) = 'wrong';
  assert (select pin_fails = 1 and key_hash = old_key from limbus.friend_posts where id = post_id), 'one try used, still the old key';
  assert limbus.guest_pin_recover('friend', post_id, pin, new_key) = 'ok';
  assert (select key_hash = new_key and guest_tag = 'aaaa' and pin_fails = 0 and pin_failed_at is null from limbus.friend_posts where id = post_id), 'handed over';

  -- Five wrong tries lock it, for the right password too, until 24 hours after the last try.
  for i in 1..5 loop assert limbus.guest_pin_recover('friend', post_id, bad, old_key) = 'wrong'; end loop;
  assert limbus.guest_pin_recover('friend', post_id, pin, old_key) = 'locked';
  assert limbus.guest_pin_recover('friend', post_id, bad, old_key) = 'locked';
  assert (select key_hash = new_key and pin_fails = 5 from limbus.friend_posts where id = post_id), 'a locked try changes nothing';
  update limbus.friend_posts set pin_failed_at = now() - interval '25 hours' where id = post_id;
  assert limbus.guest_pin_recover('friend', post_id, bad, old_key) = 'wrong';
  assert (select pin_fails = 1 from limbus.friend_posts where id = post_id), 'the count starts again after the lock';
  assert limbus.guest_pin_recover('friend', post_id, pin, old_key) = 'ok';

  -- A key that already has a post of that kind cannot take a second one.
  insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag) values('support', 'T378819935', array['10613'], new_key, 'bbbb');
  begin perform limbus.guest_pin_recover('friend', post_id, pin, new_key); assert false, 'one support post per guest';
  exception when unique_violation then null; end;

  -- No password, no post, no such kind.
  update limbus.friend_posts set pin_hash = null where id = post_id;
  assert limbus.guest_pin_recover('friend', post_id, pin, new_key) = 'none';
  assert limbus.guest_pin_recover('friend', gen_random_uuid(), pin, new_key) = 'none';
  assert limbus.guest_pin_recover('comment', post_id, pin, new_key) = 'none';

  -- Decks and plans keep the password next to the key that wrote them.
  select d.id into deck from limbus.decks d where not exists(select 1 from limbus.guest_authorship g where g.deck_id = d.id) limit 1;
  assert deck is not null, 'A deck without a guest key row is needed for the deck test';
  insert into limbus.guest_authorship(deck_id, key_hash, pin_hash) values(deck, old_key, pin);
  assert limbus.guest_pin_recover('plan', deck, pin, new_key) = 'none';
  assert limbus.guest_pin_recover('deck', deck, bad, new_key) = 'wrong';
  assert limbus.guest_pin_recover('deck', deck, pin, new_key) = 'ok';
  assert (select key_hash = new_key and pin_fails = 0 from limbus.guest_authorship where deck_id = deck), 'the deck follows the new key';
end $$;
rollback;
