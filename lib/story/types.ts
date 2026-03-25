/* ── Story Viewer Types ────────────────────────── */

export interface StoryEffect {
  type: 'shake' | 'fadeOut'
  intensity?: number
}

export interface StoryLine {
  id: number
  teller: string | null
  title: string | null
  content: string | null
  place: string | null
  /** 현재 화면에 보이는 CG 스택 (아래→위 순서) */
  activeCGs: string[]
  effect: StoryEffect | null
}

export interface EpisodeData {
  episodeId: string
  nodeId: number
  stageDetail: 'Before' | 'After'
  lines: StoryLine[]
}

export interface EpisodeSummary {
  id: number
  storyId: string
  nodeId: number
  stageDetail: 'Before' | 'After'
  lineCount: number
  nodeTitle: string | null
  nodeDesc: string | null
  firstPlace: string | null
  firstLine: string | null
}

export interface PrologueIndex {
  chapterId: number
  subChapterId: number
  episodes: EpisodeSummary[]
}
