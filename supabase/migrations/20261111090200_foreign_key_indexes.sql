-- Step 5 clean-up (2026-11-11). The 13 limbus foreign keys with no index on their column (production, 2026-11-11).
-- Every table here is under 1,000 rows, so a plain create index locks for an instant; no need for CONCURRENTLY.
-- Rollback: supabase/rollback/20261111090200_foreign_key_indexes.sql

create index if not exists identities_sinner_id_idx on limbus.identities (sinner_id);
create index if not exists identities_panic_type_idx on limbus.identities (panic_type);
create index if not exists ego_sinner_id_idx on limbus.ego (sinner_id);
create index if not exists ego_gifts_convert_to_idx on limbus.ego_gifts (convert_to);
create index if not exists identity_sanity_conditions_template_id_idx on limbus.identity_sanity_conditions (template_id);
create index if not exists profiles_suspended_by_idx on limbus.profiles (suspended_by);
create index if not exists inquiries_replied_by_idx on limbus.inquiries (replied_by);
create index if not exists developer_keys_user_id_idx on limbus.developer_keys (user_id);
create index if not exists support_messages_author_id_idx on limbus.support_messages (author_id);
create index if not exists friend_posts_user_id_idx on limbus.friend_posts (user_id);
create index if not exists friend_exchanges_viewer_user_id_idx on limbus.friend_exchanges (viewer_user_id);
create index if not exists friend_reports_reporter_user_id_idx on limbus.friend_reports (reporter_user_id);
create index if not exists friend_requests_viewer_user_id_idx on limbus.friend_requests (viewer_user_id);
