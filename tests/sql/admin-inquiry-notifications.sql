-- Inquiries waiting for an answer as an administrator's notifications. Isolated accounts and
-- inquiries; everything rolls back. Other open inquiries in the database are ignored (`mine`).
begin;
do $$
declare adm uuid := gen_random_uuid(); u uuid := gen_random_uuid();
  adm_mail text := adm || '@example.invalid';
  waiting uuid := gen_random_uuid(); followed uuid := gen_random_uuid(); seen uuid := gen_random_uuid();
  answered uuid := gen_random_uuid(); closed uuid := gen_random_uuid(); own uuid := gen_random_uuid();
  follow_up uuid := gen_random_uuid(); mine uuid[]; got text[]; row record; fn text := 'limbus.admin_inquiry_notifications(text, integer)';
begin
  mine := array[waiting, followed, seen, answered, closed, own];
  insert into auth.users(id,email) values (adm,adm_mail),(u,u || '@example.invalid');
  insert into limbus.profiles(id) values(adm),(u) on conflict do nothing;
  update limbus.profiles set username = 'n-' || left(id::text, 8), notifications_read_at = now() - interval '1 hour' where id in (adm,u);

  insert into limbus.inquiries(id,user_id,category,title,content,status) values
    (waiting,u,'bug','waiting','q','open'), (followed,u,'bug','followed','q','open'), (seen,u,'bug','seen','q','open'),
    (answered,u,'bug','answered','q','answered'), (closed,u,'bug','closed','q','closed'), (own,adm,'bug','own','q','open');
  insert into limbus.support_messages(inquiry_id,author_role,author_id,body,created_at) values
    (waiting,'user',u,repeat('가',200),now() - interval '10 minutes'),
    -- Asked, answered, then asked again: the row is the follow-up.
    (followed,'user',u,'first question',now() - interval '3 hours'),
    (followed,'admin',adm,'answer',now() - interval '2 hours'),
    -- Asked before the administrator last opened the list; an administrator's later note on the still open thread is not the row.
    (seen,'user',u,'old question',now() - interval '2 hours'),
    (seen,'admin',adm,'note',now() - interval '30 minutes'),
    (answered,'user',u,'q',now() - interval '4 minutes'), (answered,'admin',adm,'a',now() - interval '3 minutes'),
    (closed,'user',u,'q',now() - interval '2 minutes'),
    (own,'user',adm,'my own question',now() - interval '1 minute');
  insert into limbus.support_messages(id,inquiry_id,author_role,author_id,body,created_at) values
    (follow_up,followed,'user',u,'follow-up',now() - interval '5 minutes');

  -- In the order the function returns them.
  select array_agg(n.kind || ':' || n.target_type || ':' || n.target_title || ':' || n.unread order by n.ordinality) into got
    from limbus.admin_inquiry_notifications(adm_mail) with ordinality n where n.target_id = any(mine);
  assert got = array['inquiry:inquiry:followed:true','inquiry:inquiry:waiting:true','inquiry:inquiry:seen:false'],
    'open inquiries by others, newest user message first: ' || got::text;

  select * into row from limbus.admin_inquiry_notifications(adm_mail) n where n.target_id = followed;
  assert row.comment_id = follow_up and row.excerpt = 'follow-up', 'the row is the last user message';
  assert row.actor_name = 'n-' || left(u::text, 8), 'the inquirer is the actor';
  select * into row from limbus.admin_inquiry_notifications(adm_mail) n where n.target_id = seen;
  assert row.excerpt = 'old question', 'an administrator''s message is never the row: ' || row.excerpt;
  select * into row from limbus.admin_inquiry_notifications(adm_mail) n where n.target_id = waiting;
  assert char_length(row.excerpt) = 120, 'excerpt is the first 120 characters';

  assert (select count(*) = 1 from limbus.admin_inquiry_notifications(adm_mail, 1)), 'row limit';
  assert (select count(*) = 0 from limbus.admin_inquiry_notifications('nobody@example.invalid')), 'unknown account';

  perform limbus.mark_notifications_read(adm_mail);
  assert (select count(*) = 3 and not bool_or(n.unread) from limbus.admin_inquiry_notifications(adm_mail) n where n.target_id = any(mine)),
    'everything is read after marking, and stays listed while it waits';

  -- At most 50 rows, whatever is asked for.
  with many as (
    insert into limbus.inquiries(user_id,category,title,content,status) select u,'bug','many','q','open' from generate_series(1, 51) returning id
  ) insert into limbus.support_messages(inquiry_id,author_role,author_id,body) select id,'user',u,'q' from many;
  assert (select count(*) = 50 from limbus.admin_inquiry_notifications(adm_mail, 1000)), 'row cap';

  assert not has_function_privilege('anon', fn, 'execute') and not has_function_privilege('authenticated', fn, 'execute')
    and has_function_privilege('service_role', fn, 'execute'), 'only the service role runs it';

  update limbus.inquiries set status = 'answered' where id = waiting;
  assert (select count(*) = 0 from limbus.admin_inquiry_notifications(adm_mail) n where n.target_id = waiting), 'an answered inquiry leaves the list';
end $$;
rollback;
