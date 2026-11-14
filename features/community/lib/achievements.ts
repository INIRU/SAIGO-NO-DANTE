import type { ActivityKind } from './rules'
import { EASTER_EGGS, type EasterEgg } from '@/lib/easter-eggs'

export type AchievementGlyph = Exclude<ActivityKind, 'contribution'> | 'points' | 'faust' | 'clock' | 'star' | 'konami' | 'lost' | 'egg'
export type AchievementTier = 1 | 2 | 3
/** Hidden ones are easter eggs: name, condition and progress stay secret until found. */
type Achievement = { id: string; glyph: AchievementGlyph; goal: number; tier: AchievementTier; hidden?: boolean }
export type AchievementProgress = Achievement & { value: number; earned: boolean }
type AchievementStats = Record<ActivityKind, number> & { points: number }

const EGG_GLYPH: Record<EasterEgg, AchievementGlyph> = { 'faust-faces': 'faust', 'clock-head': 'clock', 'twisted-star': 'star', konami: 'konami', 'lost-manager': 'lost' }

/**
 * Community achievements from the profile's activity stats (nothing stored), then the easter eggs, which only
 * this browser knows about.
 */
const ACHIEVEMENTS: Achievement[] = [
  { id: 'deck-1', glyph: 'deck', goal: 1, tier: 1 },
  { id: 'deck-5', glyph: 'deck', goal: 5, tier: 2 },
  { id: 'deck-20', glyph: 'deck', goal: 20, tier: 3 },
  { id: 'plan-1', glyph: 'plan', goal: 1, tier: 1 },
  { id: 'plan-5', glyph: 'plan', goal: 5, tier: 2 },
  { id: 'plan-20', glyph: 'plan', goal: 20, tier: 3 },
  { id: 'like-1', glyph: 'like', goal: 1, tier: 1 },
  { id: 'like-30', glyph: 'like', goal: 30, tier: 2 },
  { id: 'points-100', glyph: 'points', goal: 100, tier: 1 },
  { id: 'points-500', glyph: 'points', goal: 500, tier: 2 },
  { id: 'points-1000', glyph: 'points', goal: 1000, tier: 3 },
  { id: 'points-3000', glyph: 'points', goal: 3000, tier: 3 },
  ...EASTER_EGGS.map(egg => ({ id: `egg-${egg}`, glyph: EGG_GLYPH[egg], goal: 1, tier: 3 as const, hidden: true })),
  { id: 'egg-all', glyph: 'egg', goal: EASTER_EGGS.length, tier: 3, hidden: true },
]

export function achievementProgress(stats: AchievementStats, eggs: readonly EasterEgg[] = []): AchievementProgress[] {
  return ACHIEVEMENTS.map(achievement => {
    const current = achievement.id === 'egg-all' ? eggs.length
      : achievement.hidden ? Number(eggs.includes(achievement.id.slice(4) as EasterEgg))
        : Math.max(0, stats[achievement.glyph as keyof AchievementStats] ?? 0)
    return { ...achievement, value: Math.min(current, achievement.goal), earned: current >= achievement.goal }
  })
}

/** The next activity-score badge and how far along it is; null once every score badge is earned. */
export function nextPointsBadge(points: number) {
  const goals = ACHIEVEMENTS.filter(a => a.glyph === 'points').map(a => a.goal)
  const index = goals.findIndex(goal => points < goal)
  if (index < 0) return null
  const from = index === 0 ? 0 : goals[index - 1]
  return { goal: goals[index], remaining: goals[index] - points, ratio: Math.max(0, (points - from) / (goals[index] - from)) }
}

type AchievementText = {
  title: string
  name: Record<string, string>
  condition: Record<'deck' | 'plan' | 'like' | 'points', string>
  /** Shown once a hidden achievement is found. */
  secret: Record<string, string>
  hiddenName: string
  hiddenCondition: string
  nextBadge: string
  allBadges: string
}

export const ACHIEVEMENT_COPY: Record<'ko' | 'en' | 'ja', AchievementText> = {
  ko: {
    title: '도전과제',
    name: {
      'deck-1': '첫 덱', 'deck-5': '덱 설계자', 'deck-20': '덱 장인',
      'plan-1': '첫 플랜', 'plan-5': '거울 던전 안내인', 'plan-20': '거울 던전 개척자',
      'like-1': '첫 좋아요', 'like-30': '응원단장',
      'points-100': '100점', 'points-500': '500점', 'points-1000': '1,000점', 'points-3000': '3,000점',
      'egg-faust-faces': '파우스트의 모든 얼굴', 'egg-clock-head': '째깍째깍', 'egg-twisted-star': '뒤틀린 별',
      'egg-konami': '코나미 커맨드', 'egg-lost-manager': '길 잃은 관리자', 'egg-all': '이스터 에그 수집가',
    },
    condition: { deck: '덱 {goal}개 작성', plan: '플랜 {goal}개 작성', like: '좋아요 {goal}번 보내기', points: '활동 점수 {goal}점' },
    secret: {
      'egg-faust-faces': '파우스트의 표정 14가지를 모두 봤다', 'egg-clock-head': '시계 머리를 일곱 번 두드렸다',
      'egg-twisted-star': 'HOSHI가 SAIGO로 뒤틀리는 순간을 붙잡았다', 'egg-konami': '↑↑↓↓←→←→BA',
      'egg-lost-manager': '존재하지 않는 페이지에 도착했다', 'egg-all': '숨겨진 이스터 에그를 모두 찾았다',
    },
    hiddenName: '???',
    hiddenCondition: '숨겨진 도전과제',
    nextBadge: '다음 뱃지까지 {remaining}점',
    allBadges: '점수 뱃지를 모두 모았어요',
  },
  en: {
    title: 'Achievements',
    name: {
      'deck-1': 'First deck', 'deck-5': 'Deck designer', 'deck-20': 'Deck artisan',
      'plan-1': 'First plan', 'plan-5': 'Mirror guide', 'plan-20': 'Mirror pathfinder',
      'like-1': 'First like', 'like-30': 'Cheer captain',
      'points-100': '100 points', 'points-500': '500 points', 'points-1000': '1,000 points', 'points-3000': '3,000 points',
      'egg-faust-faces': 'Every face of Faust', 'egg-clock-head': 'Tick tock', 'egg-twisted-star': 'Twisted star',
      'egg-konami': 'Konami code', 'egg-lost-manager': 'Lost manager', 'egg-all': 'Egg collector',
    },
    condition: { deck: 'Publish {goal} decks', plan: 'Publish {goal} plans', like: 'Send {goal} likes', points: 'Reach {goal} activity points' },
    secret: {
      'egg-faust-faces': 'Saw all 14 of Faust’s faces', 'egg-clock-head': 'Tapped the clock head seven times',
      'egg-twisted-star': 'Caught HOSHI twisting into SAIGO', 'egg-konami': '↑↑↓↓←→←→BA',
      'egg-lost-manager': 'Arrived at a page that does not exist', 'egg-all': 'Found every hidden easter egg',
    },
    hiddenName: '???',
    hiddenCondition: 'Hidden achievement',
    nextBadge: '{remaining} points to the next badge',
    allBadges: 'Every score badge collected',
  },
  ja: {
    title: '実績',
    name: {
      'deck-1': '初めてのデッキ', 'deck-5': 'デッキ設計者', 'deck-20': 'デッキ職人',
      'plan-1': '初めてのプラン', 'plan-5': '鏡ダンジョン案内人', 'plan-20': '鏡ダンジョン開拓者',
      'like-1': '初めてのいいね', 'like-30': '応援団長',
      'points-100': '100点', 'points-500': '500点', 'points-1000': '1,000点', 'points-3000': '3,000点',
      'egg-faust-faces': 'ファウストのすべての顔', 'egg-clock-head': 'チクタク', 'egg-twisted-star': 'ねじれた星',
      'egg-konami': 'コナミコマンド', 'egg-lost-manager': '迷子の管理人', 'egg-all': 'イースターエッグ収集家',
    },
    condition: { deck: 'デッキを{goal}個投稿', plan: 'プランを{goal}個投稿', like: 'いいねを{goal}回送る', points: '活動ポイント{goal}点' },
    secret: {
      'egg-faust-faces': 'ファウストの表情14種類をすべて見た', 'egg-clock-head': '時計頭を7回たたいた',
      'egg-twisted-star': 'HOSHIがSAIGOにねじれる瞬間をつかまえた', 'egg-konami': '↑↑↓↓←→←→BA',
      'egg-lost-manager': '存在しないページにたどり着いた', 'egg-all': '隠されたイースターエッグをすべて見つけた',
    },
    hiddenName: '???',
    hiddenCondition: '隠し実績',
    nextBadge: '次のバッジまで{remaining}点',
    allBadges: 'スコアバッジをすべて集めました',
  },
}
