-- Keep auth.users private. Only these service-role-only RPCs may resolve account emails.
ALTER FUNCTION limbus.admin_list_users(text,text,integer,integer) SECURITY DEFINER;
ALTER FUNCTION limbus.admin_moderate_user(text,uuid,boolean,text,integer,timestamptz,text[]) SECURITY DEFINER;
