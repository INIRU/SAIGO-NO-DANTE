-- REQ-COMMUNITY-019..023. Run against a configured development database; every fixture is rolled back.
begin;
do $$
declare owner_id uuid; support_id uuid; hash text := repeat('a', 64); other text := repeat('b', 64);
begin
  assert not has_table_privilege('anon', 'limbus.friend_posts', 'select') and not has_table_privilege('authenticated', 'limbus.friend_posts', 'select'), 'posts are service-role only';
  assert not has_table_privilege('anon', 'limbus.friend_exchanges', 'select') and not has_table_privilege('authenticated', 'limbus.friend_want_stats', 'select');

  -- A guest's support post: code format, slots and the identity list.
  insert into limbus.friend_posts(kind, code, visibility, slots, identity_ids, key_hash, guest_tag)
    values('support', 'P482593721', 'exchange', '[{"slot":5,"identity":"10613","egos":{"ZAYIN":"20601"}}]', array['10613'], hash, 'aaaa') returning id into support_id;
  begin insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag) values('support', 'p482593721', array['10613'], other, 'bbbb'); assert false, 'lower-case code';
  exception when check_violation then null; end;
  begin insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag) values('support', 'T378819935', '{}', other, 'bbbb'); assert false, 'a post names an identity';
  exception when check_violation then null; end;
  begin insert into limbus.friend_posts(kind, code, identity_ids) values('support', 'T378819935', array['10613']); assert false, 'a post has an author';
  exception when check_violation then null; end;
  begin insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag) values('support', 'T378819935', array['10613'], hash, 'aaaa'); assert false, 'one support post per guest';
  exception when unique_violation then null; end;
  begin insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag) values('support', 'P482593721', array['10613'], other, 'bbbb'); assert false, 'a code is posted once per kind';
  exception when unique_violation then null; end;

  -- The same guest may also ask for identities: no slots, at most three.
  insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag) values('want', 'P482593721', array['10115', '10613'], hash, 'aaaa');
  begin insert into limbus.friend_posts(kind, code, identity_ids, key_hash, guest_tag) values('want', 'T378819935', array['10115','10212','10310','10410'], other, 'bbbb'); assert false, 'at most three wanted';
  exception when check_violation then null; end;

  -- A signed-in author, and an exchange recorded once per viewer.
  select id into owner_id from limbus.profiles limit 1;
  assert owner_id is not null, 'A profile is needed for the author test';
  insert into limbus.friend_posts(kind, code, identity_ids, user_id) values('support', 'F185652736', array['10212'], owner_id);
  insert into limbus.friend_exchanges(post_id, viewer_key_hash, viewer_code) values(support_id, other, 'W626381513');
  begin insert into limbus.friend_exchanges(post_id, viewer_key_hash, viewer_code) values(support_id, other, 'N375776642'); assert false, 'one exchange per viewer';
  exception when unique_violation then null; end;
  insert into limbus.friend_exchanges(post_id, viewer_user_id, viewer_code) values(support_id, owner_id, 'N375776642');

  -- Deleting a post removes its exchanges; the daily counts stay on their own.
  insert into limbus.friend_want_stats(day, identity_id, count) values(current_date, '10115', 1)
    on conflict (day, identity_id) do update set count = limbus.friend_want_stats.count + 1;
  delete from limbus.friend_posts where id = support_id;
  assert not exists(select 1 from limbus.friend_exchanges where post_id = support_id), 'exchanges go with their post';
  assert exists(select 1 from limbus.friend_want_stats where day = current_date and identity_id = '10115'), 'the count stays';
end $$;
rollback;
