-- Add nullable EN/JP localization columns to mirror dungeon event choices.
ALTER TABLE limbus.md_event_choices
  ADD COLUMN IF NOT EXISTS message_en TEXT,
  ADD COLUMN IF NOT EXISTS message_jp TEXT,
  ADD COLUMN IF NOT EXISTS message_desc_en TEXT,
  ADD COLUMN IF NOT EXISTS message_desc_jp TEXT,
  ADD COLUMN IF NOT EXISTS result_text_en TEXT,
  ADD COLUMN IF NOT EXISTS result_text_jp TEXT;
