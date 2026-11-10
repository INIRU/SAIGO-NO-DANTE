import type { CSSProperties } from 'react'
import type { DungeonEvent, DungeonEventGift, DungeonEventResult, StorySubchapter, Texts } from '@/lib/story-map'
import { getGameUiAsset } from '@/lib/utils/game-ui'

// The game's event window sprites (BattleUI_Choice atlases, read off ChoiceEventController in the client): monitor
// housing 7_26, scan-line text panel 7_24, camera corners / REC 4_x, section tag 7_15, option plate 7_3, result box 8_0,
// check plate 5_20, value box 7_21 with its arrow 7_32, the red button 5_17 / 5_18 / 5_21, the check's sin icons 1_<sin>.
export const ui = (k: string) => getGameUiAsset(`event/${k}`)
/** A 9-slice game sprite as a CSS border image: slice = the sprite's borders (px, top right bottom left), width = drawn size. */
export const nine = (k: string, slice: string, width: string): CSSProperties => ({
  borderStyle: 'solid', borderWidth: width, borderImageSource: `url(${ui(k)})`, borderImageSlice: `${slice} fill`, borderImageWidth: width,
})
export const SIN_ICON: Record<string, string> = {
  CRIMSON: 'sin-crimson', SCARLET: 'sin-scarlet', AMBER: 'sin-amber', SHAMROCK: 'sin-shamrock', AZURE: 'sin-azure', INDIGO: 'sin-indigo', VIOLET: 'sin-violet',
}

export type Lang = 'ko' | 'en' | 'ja'
// lib/story-map's server helpers stay out of this client file
export const pickText = (t: Texts | null | undefined, lang: Lang) => t?.[lang] ?? t?.ko ?? t?.en ?? ''
// next/image (the gift card) allows the storage host only; the local data server (dev) is made a same-site path
const local = (url: string) => url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '')

// The game's words: 선택지 / 결과, 다음으로, 판정 성공 / 실패, 성공 값 (BattleUIText), 선택한 인격 (ChoiceEventTarget
// ChosenPersonality, for the {0} sinner of a check text); the rest are the site's labels.
export const L = {
  ko: { title: '이벤트', choices: '선택지', result: '결과', next: '다음으로', story: '이야기 보기', success: '판정 성공', fail: '판정 실패',
    threshold: '성공 값', others: '그 외 스킬', chosen: '선택한 인격', pick: (names: string) => `${names} 판정 시`, otherwise: '그 외 수감자 판정 시',
    check: '판정', checkN: (n: number, of: number) => `판정 ${n} / ${of}`, toCheck: (n: number) => `판정 ${n}(으)로`,
    pickSinner: '판정을 진행할 인격을 선택하세요',
    howCheck: '판정마다 수감자 한 명을 골라, 그 인격의 스킬을 굴려 성공 값과 비교합니다. 바로 앞 판정에 나선 수감자는 고를 수 없습니다.',
    ifSuccess: '판정 성공하면', ifFail: '판정 실패하면',
    battle: '전투', more: (n: number) => `다음 선택지 ${n}개`, needs: '이 기프트가 있어야 고를 수 있음', back: '이전으로', close: '닫기' },
  en: { title: 'Event', choices: 'Choices', result: 'Result', next: 'Next', story: 'Read the story', success: 'Check Passed', fail: 'Check Failed',
    threshold: 'Threshold', others: 'Other skills', chosen: 'The Selected Identity', pick: (names: string) => `If ${names} takes it`, otherwise: 'Anyone else',
    check: 'Check', checkN: (n: number, of: number) => `Check ${n} / ${of}`, toCheck: (n: number) => `To check ${n}`,
    pickSinner: 'Select an Identity for the check',
    howCheck: 'Each check, one Sinner is picked and their Identity’s skill is rolled against the threshold. The Sinner from the check just before cannot be picked.',
    ifSuccess: 'If it passes', ifFail: 'If it fails',
    battle: 'Battle', more: (n: number) => `${n} more choices`, needs: 'Needs this gift', back: 'Back', close: 'Close' },
  ja: { title: 'イベント', choices: '選択肢', result: '結果', next: '次へ', story: 'ストーリーを見る', success: '判定成功', fail: '判定失敗',
    threshold: '成功値', others: 'その他のスキル', chosen: '選択した人格', pick: (names: string) => `${names}が判定した場合`, otherwise: 'それ以外の囚人',
    check: '判定', checkN: (n: number, of: number) => `判定 ${n} / ${of}`, toCheck: (n: number) => `判定 ${n} へ`,
    pickSinner: '判定を行う人格を選択してください',
    howCheck: '判定ごとに囚人を一人選び、その人格のスキルを振って成功値と比べます。直前の判定に出た囚人は選べません。',
    ifSuccess: '判定成功なら', ifFail: '判定失敗なら',
    battle: '戦闘', more: (n: number) => `次の選択肢 ${n}個`, needs: 'このギフトが必要', back: '戻る', close: '閉じる' },
}
const SINNER_NAMES: Record<string, Record<Lang, string>> = {
  yisang: { ko: '이상', en: 'Yi Sang', ja: 'イサン' }, faust: { ko: '파우스트', en: 'Faust', ja: 'ファウスト' },
  donquixote: { ko: '돈키호테', en: 'Don Quixote', ja: 'ドンキホーテ' }, ryoshu: { ko: '료슈', en: 'Ryōshū', ja: '良秀' },
  meursault: { ko: '뫼르소', en: 'Meursault', ja: 'ムルソー' }, honglu: { ko: '홍루', en: 'Hong Lu', ja: 'ホンル' },
  heathcliff: { ko: '히스클리프', en: 'Heathcliff', ja: 'ヒースクリフ' }, ishmael: { ko: '이스마엘', en: 'Ishmael', ja: 'イシュメール' },
  rodion: { ko: '로쟈', en: 'Rodion', ja: 'ロージャ' }, sinclair: { ko: '싱클레어', en: 'Sinclair', ja: 'シンクレア' },
  outis: { ko: '오티스', en: 'Outis', ja: 'ウーティス' }, gregor: { ko: '그레고르', en: 'Gregor', ja: 'グレゴール' },
}
// the game's gift keyword (ego-gift keyword) → the site's Korean keyword (GiftArtwork's keyword icon and colour)
export const GIFT_KEYWORD: Record<string, string> = {
  Combustion: '화상', Laceration: '출혈', Vibration: '진동', Burst: '파열', Sinking: '침잠', Breath: '호흡', Charge: '충전',
  Slash: '참격', Penetrate: '관통', Hit: '타격',
}
// The game's effect text colours on the site's palette (DESIGN.md: no neon; each colour keeps its meaning)
export const TONE: Record<string, string> = {
  ebcaa2: '#e8dcc8', e30000: '#ec6a5e', ff0000: '#ec6a5e', fe4b48: '#ec6a5e', '80c9ff': '#8cc4ea', '00ff9c': '#7fd1a4',
  f8c200: '#e8b030', a16a3b: '#b0a890',
  // sin names: lib/constants/sin's colours; pride and envy a step lighter to read on the dark card
  fd6600: '#d06030', fecc2b: '#d4b830', '9eff00': '#88b028', '15c3ee': '#4898b0', '004bd5': '#5b8fd0', '9400dc': '#9a74c4',
}
// The same colours as ink on the check's paper plate (dark enough to read on the beige)
export const INK: Record<string, string> = {
  ebcaa2: '#3a2a1a', e30000: '#a3261b', ff0000: '#a3261b', fe4b48: '#a3261b', '80c9ff': '#1f5f8c', '00ff9c': '#1d6b45',
  f8c200: '#8a5a00', a16a3b: '#5a4026', fd6600: '#a8440c', fecc2b: '#7f6000', '9eff00': '#4a7410', '15c3ee': '#1b6a86',
  '004bd5': '#1d4fb8', '9400dc': '#6a2fa0',
}

export type ChoiceEvent = Extract<DungeonEvent, { kind: 'choice' }>
export type CheckEvent = Extract<DungeonEvent, { kind: 'check' }>
/** A step of the story view, as the game goes: an event, a picked option's result, a check's outcome */
export type Step = { t: 'event'; id: number } | { t: 'judge'; id: number } | { t: 'option'; id: number; idx: number } | { t: 'outcome'; id: number; side: 'success' | 'fail' }
export type Ctx = { events: Record<string, DungeonEvent>; gifts: Record<string, DungeonEventGift>; lang: Lang; sub: StorySubchapter; base: string
  openGift: (id: string) => void; go: (step: Step) => void }
export type Reward = { type?: string; rewardId?: number }

/** A result's condition as a short label: a probability, a picked sinner; others (the game does not show them) none. */
export function condLabel(cond: string, lang: Lang): string | null {
  const s = L[lang]
  const p = /^Prob_([\d.]+)$/.exec(cond)
  if (p) return Number(p[1]) >= 1 ? null : `${Math.round(Number(p[1]) * 100)}%`
  const u = /^ChooseUnit_([^:]+)(:Not)?$/.exec(cond)
  if (u) return u[2] ? s.otherwise : s.pick(u[1].split(',').map(n => SINNER_NAMES[n.toLowerCase()]?.[lang] ?? n).join(', '))
  return null
}

/** The gift ids a lock (cantSelectInThisCase: HasNotEgoGift_<ids>, HasNotEnoughEgoGift_<id>_<n>, HasNotEgoGiftList_<n>_<a:b>) asks for. */
export const lockGifts = (lock?: string) => (lock && /EgoGift/.test(lock) ? [...new Set(lock.split('_').slice(1).join('_').match(/\d{3,}/g) ?? [])] : [])

export const giftArt = (id: string, g: DungeonEventGift, base: string, lang: Lang) => ({
  // no TIER_n tag in the game data (8장 items): no grade mark (GiftGrade shows I for a null grade)
  name: pickText(g.name, lang), grade: g.grade ?? '', keyword: g.keyword ? GIFT_KEYWORD[g.keyword] ?? null : null,
  image_url: local(`${base}/gift/${id}.webp`),
})

/** What an option can lead to, for the icons at its bar's end: the gifts it gives (not destroys), a battle, a check's sins. */
export function reach(results: DungeonEventResult[], ctx: Ctx, seen: Set<number>, out = { gifts: new Set<string>(), battle: false, sins: new Set<string>() }) {
  for (const r of results) {
    for (const f of r.effects ?? []) {
      const rw = f.itemReward as Reward | undefined
      if (rw?.type === 'EGO_GIFT' && rw.rewardId != null && !/^(Destroy|Lose)/.test(f.resultEffect ?? '') && ctx.gifts[String(rw.rewardId)]) out.gifts.add(String(rw.rewardId))
      if (f.battle) out.battle = true
    }
    const next = r.next != null && !seen.has(r.next) ? ctx.events[String(r.next)] : undefined
    if (next?.kind === 'check') {
      next.sins.forEach(x => out.sins.add(x))
      const more = new Set([...seen, next.id])
      reach(next.success.results, ctx, more, out)
      reach(next.failure.results, ctx, more, out)
    }
  }
  return out
}

/** The text the monitor shows at a step: the event's scene, a check's outcome text ({0}: the sinner who took it). */
export function monitorText(step: Step, ctx: Ctx): string {
  const ev = ctx.events[String(step.id)]
  if (!ev) return ''
  if (step.t === 'outcome' && ev.kind === 'check') {
    const side = step.side === 'success' ? ev.success : ev.failure
    // one text per branch in the data, often the same words: each once
    return [...new Set(side.text.map(t => pickText(t, ctx.lang)).filter(Boolean))].join('\n\n').replaceAll('{0}', L[ctx.lang].chosen)
  }
  return pickText(ev.desc, ctx.lang)
}
/** The checks that follow one another from a first one (what either outcome leads to), in the order the game runs them. */
export function checkChain(first: CheckEvent, ctx: Ctx, seen: Set<number>): CheckEvent[] {
  const out: CheckEvent[] = []
  const ids = new Set(seen)
  const queue: CheckEvent[] = [first]
  while (queue.length) {
    const ev = queue.shift()!
    if (ids.has(ev.id)) continue
    ids.add(ev.id)
    out.push(ev)
    for (const r of [...ev.success.results, ...ev.failure.results]) {
      const n = r.next != null ? ctx.events[String(r.next)] : undefined
      if (n?.kind === 'check' && !ids.has(n.id)) queue.push(n)
    }
  }
  return out
}
