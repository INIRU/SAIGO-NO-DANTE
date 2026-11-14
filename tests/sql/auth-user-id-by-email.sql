-- Run against a configured database; every fixture is rolled back.
begin;
do $$
declare
  uid uuid := gen_random_uuid();
  mail text := 'lookup-test-' || uid || '@example.invalid';
begin
  assert not has_function_privilege('anon', 'limbus.auth_user_id_by_email(text)', 'execute'), 'anon cannot look up users';
  assert not has_function_privilege('authenticated', 'limbus.auth_user_id_by_email(text)', 'execute'), 'signed-in clients cannot look up users';
  assert has_function_privilege('service_role', 'limbus.auth_user_id_by_email(text)', 'execute');

  assert limbus.auth_user_id_by_email(mail) is null, 'an unknown email has no id';
  insert into auth.users(id, email) values (uid, mail);
  assert limbus.auth_user_id_by_email(mail) = uid, 'a known email gives its id';
  assert limbus.auth_user_id_by_email(upper(mail)) = uid, 'case does not matter';
end $$;
rollback;
