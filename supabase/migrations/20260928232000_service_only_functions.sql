-- These SECURITY DEFINER functions change vote/view/comment counts or reveal a user's role by e-mail. The site calls
-- them only with the service role; the public could call them directly (e.g. increment_vote in a loop).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'limbus' and p.proname in ('decrement_comment', 'decrement_vote', 'get_user_role', 'handle_new_user',
      'increment_comment', 'increment_md_plan_view', 'increment_view', 'increment_vote', 'is_user_suspended', 'toggle_plan_vote')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
