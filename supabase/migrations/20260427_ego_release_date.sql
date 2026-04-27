ALTER TABLE limbus.ego
  ADD COLUMN IF NOT EXISTS release_date TEXT;

COMMENT ON COLUMN limbus.ego.release_date IS
  'EGO release date in YYYY-MM-DD format, sourced from local game JSON updatedDate.';
