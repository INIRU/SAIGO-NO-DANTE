-- The key check moved to consume_developer_key(text,text[]) in 20261006120000_partners_and_news.sql. The old name was kept
-- for the code deployed before that change; no deployment calls it any more.
-- Rollback: recreate it from 20261005150000_developer_partner.sql, with the grants from
-- 20260912103513_developer_api_and_interest.sql.
drop function limbus.consume_developer_request(text);
