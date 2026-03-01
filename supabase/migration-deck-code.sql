-- decks 테이블에 편성코드 컬럼 추가
ALTER TABLE limbus.decks ADD COLUMN IF NOT EXISTS deck_code TEXT;
