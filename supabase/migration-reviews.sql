-- 인격 리뷰 (개추/비추 + 한줄평)
CREATE TABLE IF NOT EXISTS limbus.identity_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES limbus.identities(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  is_positive BOOLEAN NOT NULL,          -- true=개추, false=비추
  content     TEXT DEFAULT '',           -- 한줄평 (최대 100자)
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identity_id, user_id)           -- 인격당 1인 1리뷰
);

ALTER TABLE limbus.identity_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON limbus.identity_reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_insert" ON limbus.identity_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update" ON limbus.identity_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "reviews_delete" ON limbus.identity_reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_identity_reviews_identity ON limbus.identity_reviews(identity_id);
CREATE INDEX idx_identity_reviews_user ON limbus.identity_reviews(user_id);
