-- Cleanup: the removed post translation feature, and empty tables no code or database function uses
-- (one-off backups from 2026-04, the deprecated mirror dungeon events table, unused chat/guide/review/translation tables).
drop table if exists limbus.post_translations;
drop table if exists
  limbus._md_events_img_backup,
  limbus._mirror_dungeon_events_deprecated_2026_04_19,
  limbus.backup_20260430_identity_sync_ego,
  limbus.backup_20260430_identity_sync_ego_skills,
  limbus.backup_20260430_identity_sync_identities,
  limbus.backup_20260430_identity_sync_passives,
  limbus.backup_20260430_identity_sync_skills,
  limbus.chat_logs,
  limbus.game_translations,
  limbus.identity_guides,
  limbus.identity_reviews;
