-- REQ-COMMUNITY-013 REQ-COMMUNITY-014: comment notifications. Isolated accounts and posts; everything rolls back.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  a_mail text := a || '@example.invalid'; b_mail text := b || '@example.invalid';
  a_deck uuid := gen_random_uuid(); b_deck uuid := gen_random_uuid(); a_plan uuid := gen_random_uuid();
  on_a_deck uuid := gen_random_uuid(); a_on_b_deck uuid := gen_random_uuid(); a_on_own uuid := gen_random_uuid();
  kinds text[]; row record;
begin
  insert into auth.users(id,email) values (a,a_mail),(b,b_mail);
  insert into limbus.profiles(id) values(a),(b) on conflict do nothing;
  update limbus.profiles set username = 'n-' || left(id::text, 8), notifications_read_at = now() - interval '1 hour' where id in (a,b);
  insert into limbus.decks(id,user_id,title) values (a_deck,a,'a deck'),(b_deck,b,'b deck');
  insert into limbus.md_plans(id,user_id,title) values (a_plan,a,'a plan');

  -- On a's deck: b comments (unread), a comments (own), b replies under a's comment (one row, as a reply), a replies to b (own).
  insert into limbus.deck_comments(id,deck_id,user_id,content,parent_id,created_at) values
    (on_a_deck,a_deck,b,repeat('가',200),null,now() - interval '10 minutes'),
    (a_on_own,a_deck,a,'mine',null,now() - interval '9 minutes');
  insert into limbus.deck_comments(deck_id,user_id,content,parent_id,created_at) values
    (a_deck,b,'reply on own deck',a_on_own,now() - interval '8 minutes'),
    (a_deck,a,'own reply',on_a_deck,now() - interval '7 minutes');
  -- On b's deck: a comments, b replies to it (a reply for a, a is not the owner).
  insert into limbus.deck_comments(id,deck_id,user_id,content,created_at) values (a_on_b_deck,b_deck,a,'a on b deck',now() - interval '6 minutes');
  insert into limbus.deck_comments(deck_id,user_id,content,parent_id,created_at) values (b_deck,b,'b replies',a_on_b_deck,now() - interval '5 minutes');
  -- On a's plan: b commented before a last read.
  insert into limbus.md_plan_comments(plan_id,user_id,content,created_at) values (a_plan,b,'old plan comment',now() - interval '2 hours');

  select array_agg(n.kind || ':' || n.target_type || ':' || n.unread order by n.created_at desc) into kinds from limbus.user_notifications(a_mail) n;
  assert kinds = array['reply:deck:true','reply:deck:true','comment:deck:true','comment:plan:false'], 'a sees others'' comments and replies, newest first: ' || kinds::text;

  select * into row from limbus.user_notifications(a_mail) n where n.comment_id = on_a_deck;
  assert row.target_id = a_deck and row.target_title = 'a deck' and row.actor_name = 'n-' || left(b::text, 8), 'post and author';
  assert char_length(row.excerpt) = 120, 'excerpt is the first 120 characters';

  select array_agg(n.kind || ':' || n.target_title order by n.created_at desc) into kinds from limbus.user_notifications(b_mail) n;
  assert kinds = array['comment:b deck','reply:a deck'], 'b sees a''s comment on b''s deck and a''s reply to b: ' || kinds::text;

  assert (select count(*) = 1 from limbus.user_notifications(a_mail, 1)), 'row limit';
  assert (select count(*) = 0 from limbus.user_notifications('nobody@example.invalid')), 'unknown account';

  perform limbus.mark_notifications_read(a_mail);
  assert (select count(*) = 4 and not bool_or(n.unread) from limbus.user_notifications(a_mail) n), 'everything is read after marking';
  assert (select bool_or(n.unread) from limbus.user_notifications(b_mail) n), 'marking a does not touch b';
end $$;
rollback;
