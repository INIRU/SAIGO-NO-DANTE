-- Limbus Archive - Supabase 데이터베이스 스키마
-- 커스텀 스키마: limbus
-- 실행 방법: Supabase Dashboard > SQL Editor에서 순서대로 실행

-- ① 스키마 생성
CREATE SCHEMA IF NOT EXISTS limbus;

-- Supabase가 limbus 스키마를 노출하도록 search_path 설정
-- (Dashboard > Settings > API > Extra search path 에 'limbus' 추가 필요)

-- ② 12 죄인
CREATE TABLE IF NOT EXISTS limbus.sinners (
  id              TEXT PRIMARY KEY,  -- 'yi-sang', 'faust' 등
  name            TEXT NOT NULL,
  name_kr         TEXT NOT NULL,
  description     TEXT,
  literary_source TEXT,
  order_num       INT UNIQUE          -- 1-12 순서
);

-- ③ 인격 (Identity)
CREATE TABLE IF NOT EXISTS limbus.identities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinner_id    TEXT REFERENCES limbus.sinners(id),
  name         TEXT NOT NULL,
  name_kr      TEXT,
  tier         INT DEFAULT 1,      -- 1-4 (해금 티어)
  hp           INT,
  speed_min    INT,
  speed_max    INT,
  def_level    INT,
  sin_affinity TEXT,               -- 'wrath','lust','sloth' 등
  keywords     TEXT[],
  rarity       INT DEFAULT 1 NOT NULL, -- 1, 2, 3
  game_id      TEXT,               -- 게임 내부 ID (이미지 파일 접두사)
  folder_name  TEXT                -- Supabase Storage 영문 폴더명
);

-- ④ 스킬
CREATE TABLE IF NOT EXISTS limbus.skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id  UUID REFERENCES limbus.identities(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  skill_type   TEXT,               -- 'attack','defense','counter','evade'
  sin_affinity TEXT,
  coins        INT DEFAULT 1,
  base_power   INT,
  coin_power   INT,
  description  TEXT,
  skill_order  INT                 -- 1,2,3 (스킬 슬롯)
);

-- ⑤ EGO
CREATE TABLE IF NOT EXISTS limbus.ego (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinner_id       TEXT REFERENCES limbus.sinners(id),
  name            TEXT NOT NULL,
  name_kr         TEXT,
  grade           TEXT,            -- 'ZAYIN','TETH','HE','WAW','ALEPH'
  sin_affinity    TEXT,
  description     TEXT,
  corrosion_risk  TEXT,
  folder_name     TEXT,            -- 로컬 폴더명 (이미지 경로)
  image_url       TEXT             -- awaken_profile.webp 전체 URL
);

-- ⑥ 유저 프로필 (auth.users 확장)
CREATE TABLE IF NOT EXISTS limbus.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT UNIQUE,
  avatar_url TEXT,
  role       TEXT DEFAULT 'user',
  suspended  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ⑦ 덱
CREATE TABLE IF NOT EXISTS limbus.decks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES limbus.profiles(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  tags        TEXT[] DEFAULT '{}',
  vote_count  INT DEFAULT 0,
  view_count  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ⑧ 덱 인격 구성 (최대 12개)
CREATE TABLE IF NOT EXISTS limbus.deck_identities (
  deck_id     UUID REFERENCES limbus.decks(id) ON DELETE CASCADE,
  identity_id UUID REFERENCES limbus.identities(id) ON DELETE CASCADE,
  slot_order  INT,
  gacksung    BOOLEAN DEFAULT FALSE,
  s1_count    INT DEFAULT 3,
  s2_count    INT DEFAULT 2,
  s3_count    INT DEFAULT 1,
  PRIMARY KEY (deck_id, identity_id)
);
-- 기존 테이블 마이그레이션 (이미 생성된 경우):
-- ALTER TABLE limbus.deck_identities ADD COLUMN IF NOT EXISTS gacksung BOOLEAN DEFAULT FALSE;
-- ALTER TABLE limbus.deck_identities ADD COLUMN IF NOT EXISTS s1_count INT DEFAULT 3;
-- ALTER TABLE limbus.deck_identities ADD COLUMN IF NOT EXISTS s2_count INT DEFAULT 2;
-- ALTER TABLE limbus.deck_identities ADD COLUMN IF NOT EXISTS s3_count INT DEFAULT 1;

-- ⑨ 좋아요
CREATE TABLE IF NOT EXISTS limbus.deck_votes (
  deck_id UUID REFERENCES limbus.decks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (deck_id, user_id)
);

-- ── 함수 & 트리거 ──────────────────────────────────────────

-- vote_count 증감 RPC
CREATE OR REPLACE FUNCTION limbus.increment_vote(deck_id UUID)
RETURNS void AS $$
  UPDATE limbus.decks SET vote_count = vote_count + 1 WHERE id = deck_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION limbus.increment_view(deck_id UUID)
RETURNS void AS $$
  UPDATE limbus.decks SET view_count = view_count + 1 WHERE id = deck_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION limbus.decrement_vote(deck_id UUID)
RETURNS void AS $$
  UPDATE limbus.decks SET vote_count = GREATEST(0, vote_count - 1) WHERE id = deck_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION limbus.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decks_updated_at
  BEFORE UPDATE ON limbus.decks
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();

-- 새 유저 가입 시 프로필 자동 생성
CREATE OR REPLACE FUNCTION limbus.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO limbus.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION limbus.handle_new_user();

-- 이메일로 유저 역할 조회 (NextAuth JWT 콜백용)
CREATE OR REPLACE FUNCTION limbus.get_user_role(user_email TEXT)
RETURNS TEXT AS $$
  SELECT COALESCE(p.role, 'user')
  FROM limbus.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 이메일로 유저 정지 상태 조회
CREATE OR REPLACE FUNCTION limbus.is_user_suspended(user_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(p.suspended, FALSE)
  FROM limbus.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ⑩ 공지사항
CREATE TABLE IF NOT EXISTS limbus.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  pinned      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON limbus.announcements
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();

-- ⑪ 덱 북마크
CREATE TABLE IF NOT EXISTS limbus.deck_bookmarks (
  deck_id    UUID REFERENCES limbus.decks(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (deck_id, user_id)
);

-- ⑫ 덱 댓글
CREATE TABLE IF NOT EXISTS limbus.deck_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id    UUID REFERENCES limbus.decks(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES limbus.profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- decks 테이블에 comment_count 추가
ALTER TABLE limbus.decks ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0;

-- 댓글 수 증감 RPC
CREATE OR REPLACE FUNCTION limbus.increment_comment(deck_id UUID)
RETURNS void AS $$
  UPDATE limbus.decks SET comment_count = comment_count + 1 WHERE id = deck_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION limbus.decrement_comment(deck_id UUID)
RETURNS void AS $$
  UPDATE limbus.decks SET comment_count = GREATEST(0, comment_count - 1) WHERE id = deck_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── RLS (Row Level Security) ───────────────────────────────

ALTER TABLE limbus.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.decks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.deck_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.sinners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.identities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.ego           ENABLE ROW LEVEL SECURITY;

-- 게임 데이터: 누구나 읽기
CREATE POLICY "sinners_select"    ON limbus.sinners    FOR SELECT USING (true);
CREATE POLICY "identities_select" ON limbus.identities FOR SELECT USING (true);
CREATE POLICY "ego_select"        ON limbus.ego        FOR SELECT USING (true);

-- 프로필: 누구나 읽기, 본인만 수정
CREATE POLICY "profiles_select" ON limbus.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON limbus.profiles FOR UPDATE USING (auth.uid() = id);

-- 덱: 누구나 읽기, 로그인 유저 생성, 본인만 수정/삭제
CREATE POLICY "decks_select" ON limbus.decks FOR SELECT USING (true);
CREATE POLICY "decks_insert" ON limbus.decks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "decks_update" ON limbus.decks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "decks_delete" ON limbus.decks FOR DELETE USING (auth.uid() = user_id);

-- 좋아요: 누구나 읽기, 로그인 유저만 추가/삭제
CREATE POLICY "votes_select" ON limbus.deck_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON limbus.deck_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_delete" ON limbus.deck_votes FOR DELETE USING (auth.uid() = user_id);

-- 북마크: 누구나 읽기, 로그인 유저만 추가/삭제
ALTER TABLE limbus.deck_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks_select" ON limbus.deck_bookmarks FOR SELECT USING (true);
CREATE POLICY "bookmarks_insert" ON limbus.deck_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookmarks_delete" ON limbus.deck_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- 댓글: 누구나 읽기, 로그인 유저만 추가, 본인만 삭제
ALTER TABLE limbus.deck_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON limbus.deck_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON limbus.deck_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON limbus.deck_comments FOR DELETE USING (auth.uid() = user_id);

-- 공지사항: 누구나 읽기
ALTER TABLE limbus.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select" ON limbus.announcements FOR SELECT USING (true);
