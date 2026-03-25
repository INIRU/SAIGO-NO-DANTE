-- Story Viewer: DB Schema
-- Supabase SQL Editor에서 실행

-- 1. story_characters (캐릭터 메타)
CREATE TABLE IF NOT EXISTS limbus.story_characters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  en_name TEXT,
  jp_name TEXT,
  file_name TEXT NOT NULL,
  nick_name TEXT,
  name_tag_color TEXT,
  portrait_sprite_path TEXT,
  staring_side TEXT DEFAULT 'middle'
);

-- 2. story_episodes (에피소드 메타)
CREATE TABLE IF NOT EXISTS limbus.story_episodes (
  id TEXT PRIMARY KEY,
  chapter TEXT NOT NULL,
  chapter_title TEXT,
  episode_title TEXT,
  sort_order INTEGER NOT NULL,
  episode_type TEXT DEFAULT 'dialog',
  line_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. story_lines (대사 + 스테이징)
CREATE TABLE IF NOT EXISTS limbus.story_lines (
  id SERIAL PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES limbus.story_episodes(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  teller TEXT,
  model TEXT,
  content TEXT,
  place TEXT,
  bg TEXT,
  bgm TEXT,
  cg TEXT,
  effect TEXT,
  feeling TEXT,
  character_list TEXT,
  sound_effect TEXT,
  UNIQUE(episode_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_story_lines_episode ON limbus.story_lines(episode_id);

-- RLS 정책 (공개 읽기)
ALTER TABLE limbus.story_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.story_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.story_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_characters_public_read" ON limbus.story_characters FOR SELECT USING (true);
CREATE POLICY "story_episodes_public_read" ON limbus.story_episodes FOR SELECT USING (true);
CREATE POLICY "story_lines_public_read" ON limbus.story_lines FOR SELECT USING (true);
