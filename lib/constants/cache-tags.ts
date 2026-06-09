// ── Cache Tag Constants ─────────────────────────────────────────────────────
// Next.js 16 `cacheTag` / `updateTag` / `revalidateTag` 에서 사용하는 태그 상수.
// 문자열 리터럴 인라인 금지 — 오타 방지 + refactoring 안전성 확보.
//
// 사용 패턴:
//   page.tsx  → 'use cache'; cacheLife('max'); cacheTag(CACHE_TAGS.sinners, CACHE_TAGS.gameData)
//   mutation route → updateTag(CACHE_TAGS.deck(id)); updateTag(CACHE_TAGS.decksList)
//   admin sync trigger → revalidateTag(tag, 'max') for tag in ALL_GAME_DATA_TAGS

export const CACHE_TAGS = {
  // ── 게임 데이터 (목요일 패치 시 일괄 invalidate) ───────────────────────────
  gameData: 'game-data',
  sinners: 'sinners',
  identities: 'identities',
  ego: 'ego',
  egoGifts: 'ego-gifts',
  themes: 'themes',
  keywords: 'keywords',
  tierList: 'tier-list',
  meta: 'meta',
  mirrorDungeon: 'mirror-dungeon',

  // ── 공지 (admin 수정 시) ──────────────────────────────────────────────────
  announcements: 'announcements',
  calendar: 'calendar',

  // ── 유저 콘텐츠 (user mutation 시) ────────────────────────────────────────
  decksList: 'decks-list',
  plansList: 'plans-list',

  // ── 엔티티별 동적 태그 생성 (id 알아야 함) ────────────────────────────────
  sinner: (slug: string) => `sinner-${slug}`,
  egoEntry: (id: string) => `ego-${id}`,
  deck: (id: string) => `deck-${id}`,
  plan: (id: string) => `plan-${id}`,
} as const

// 목요일 sync 완료 시 일괄 invalidate 대상
export const ALL_GAME_DATA_TAGS: readonly string[] = [
  CACHE_TAGS.gameData,
  CACHE_TAGS.sinners,
  CACHE_TAGS.identities,
  CACHE_TAGS.ego,
  CACHE_TAGS.egoGifts,
  CACHE_TAGS.themes,
  CACHE_TAGS.keywords,
  CACHE_TAGS.tierList,
  CACHE_TAGS.meta,
  CACHE_TAGS.mirrorDungeon,
] as const

// 정적 (문자열 리터럴) 게임 데이터 태그만 허용하는 유니언 타입.
// 동적 엔티티 태그(sinner/egoEntry/deck/plan)는 별도 타입 체계.
export type GameDataTag = typeof CACHE_TAGS[
  | 'gameData'
  | 'sinners'
  | 'identities'
  | 'ego'
  | 'egoGifts'
  | 'themes'
  | 'keywords'
  | 'tierList'
  | 'meta'
  | 'mirrorDungeon'
]
