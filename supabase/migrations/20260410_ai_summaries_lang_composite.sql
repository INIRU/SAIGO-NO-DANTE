-- Update existing records to have lang = 'ko' where null
UPDATE limbus.identity_ai_summaries
SET lang = 'ko'
WHERE lang IS NULL;

-- Drop existing unique constraint on identity_id
ALTER TABLE limbus.identity_ai_summaries
DROP CONSTRAINT IF EXISTS identity_ai_summaries_pkey;

ALTER TABLE limbus.identity_ai_summaries
DROP CONSTRAINT IF EXISTS identity_ai_summaries_identity_id_key;

-- Add composite unique constraint
ALTER TABLE limbus.identity_ai_summaries
ADD CONSTRAINT identity_ai_summaries_identity_id_lang_key
UNIQUE (identity_id, lang);

-- Set default for lang column
ALTER TABLE limbus.identity_ai_summaries
ALTER COLUMN lang SET DEFAULT 'ko';

ALTER TABLE limbus.identity_ai_summaries
ALTER COLUMN lang SET NOT NULL;
