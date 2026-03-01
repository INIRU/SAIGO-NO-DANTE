-- deck_egos 테이블: 덱 에고 편성 저장
CREATE TABLE IF NOT EXISTS limbus.deck_egos (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id  UUID NOT NULL REFERENCES limbus.decks(id) ON DELETE CASCADE,
  ego_id   UUID NOT NULL REFERENCES limbus.ego(id),
  grade    TEXT NOT NULL,  -- ZAYIN, TETH, HE, WAW, ALEPH
  UNIQUE(deck_id, ego_id)
);

ALTER TABLE limbus.deck_egos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deck_egos_public_read"
  ON limbus.deck_egos FOR SELECT USING (true);

CREATE POLICY "deck_egos_insert_auth"
  ON limbus.deck_egos FOR INSERT WITH CHECK (true);

CREATE POLICY "deck_egos_delete_auth"
  ON limbus.deck_egos FOR DELETE USING (true);
      