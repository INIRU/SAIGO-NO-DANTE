-- Drops the indexes added by migrations/20261111090200_foreign_key_indexes.sql.

drop index if exists limbus.identities_sinner_id_idx;
drop index if exists limbus.identities_panic_type_idx;
drop index if exists limbus.ego_sinner_id_idx;
drop index if exists limbus.ego_gifts_convert_to_idx;
drop index if exists limbus.identity_sanity_conditions_template_id_idx;
drop index if exists limbus.profiles_suspended_by_idx;
drop index if exists limbus.inquiries_replied_by_idx;
drop index if exists limbus.developer_keys_user_id_idx;
drop index if exists limbus.support_messages_author_id_idx;
drop index if exists limbus.friend_posts_user_id_idx;
drop index if exists limbus.friend_exchanges_viewer_user_id_idx;
drop index if exists limbus.friend_reports_reporter_user_id_idx;
drop index if exists limbus.friend_requests_viewer_user_id_idx;
