-- Add EN/JP columns to panic_types
ALTER TABLE limbus.panic_types
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_jp TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_jp TEXT;

-- Backfill the 2 generic panic types from game locale files
UPDATE limbus.panic_types
SET name_en = 'Panic',
    name_jp = 'パニック',
    description_en = 'Does not act for this turn.',
    description_jp = '1ターンの間行動しない'
WHERE id = 9999;

UPDATE limbus.panic_types
SET name_en = 'Love and Hate',
    name_jp = '愛と憎悪',
    description_en = 'Does not act for this turn.',
    description_jp = '1ターンの間行動しない'
WHERE id = 9994;

-- Add EN/JP columns to mental_condition_templates
ALTER TABLE limbus.mental_condition_templates
  ADD COLUMN IF NOT EXISTS add_text_en TEXT,
  ADD COLUMN IF NOT EXISTS add_text_jp TEXT,
  ADD COLUMN IF NOT EXISTS min_text_en TEXT,
  ADD COLUMN IF NOT EXISTS min_text_jp TEXT;
