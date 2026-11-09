'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Lock, Swords, X } from 'lucide-react'
import type { DungeonEvent, DungeonEventEffect, DungeonEventGift, DungeonEventResult, StorySubchapter, Texts } from '@/lib/story-map'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import GiftDetailModal from '@/features/mirror-dungeon/components/GiftDetailModal'
import GiftArtwork from '@/components/ui/GiftArtwork'
import BaseModal from '@/components/ui/BaseModal'
import { buttonClass } from '@/components/ui/Button'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { isTouch } from './landscape'

// The game's event window sprites (BattleUI_Choice atlases, read off ChoiceEventController in the client): monitor
// housing 7_26, scan-line text panel 7_24, camera corners / REC 4_x, section tag 7_15, option plate 7_3, result box 8_0,
// check plate 5_20, value box 7_21 with its arrow 7_32, the red button 5_17 / 5_18 / 5_21, the check's sin icons 1_<sin>.
const ui = (k: string) => getGameUiAsset(`event/${k}`)
/** A 9-slice game sprite as a CSS border image: slice = the sprite's borders (px, top right bottom left), width = drawn size. */
const nine = (k: string, slice: string, width: string): CSSProperties => ({
  borderStyle: 'solid', borderWidth: width, borderImageSource: `url(${ui(k)})`, borderImageSlice: `${slice} fill`, borderImageWidth: width,
})
const SIN_ICON: Record<string, string> = {
  CRIMSON: 'sin-crimson', SCARLET: 'sin-scarlet', AMBER: 'sin-amber', SHAMROCK: 'sin-shamrock', AZURE: 'sin-azure', INDIGO: 'sin-indigo', VIOLET: 'sin-violet',
}

type Lang = 'ko' | 'en' | 'ja'
// lib/story-map's server helpers stay out of this client file
const pickText = (t: Texts | null | undefined, lang: Lang) => t?.[lang] ?? t?.ko ?? t?.en ?? ''
// next/image (the gift card) allows the storage host only; the local data server (dev) is made a same-site path
const local = (url: string) => url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '')

// The game's words: 선택지 / 결과, 다음으로, 판정 성공 / 실패, 성공 값 (BattleUIText), 선택한 인격 (ChoiceEventTarget
// ChosenPersonality, for the {0} sinner of a check text); the rest are the site's labels.
const L = {
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
const GIFT_KEYWORD: Record<string, string> = {
  Combustion: '화상', Laceration: '출혈', Vibration: '진동', Burst: '파열', Sinking: '침잠', Breath: '호흡', Charge: '충전',
  Slash: '참격', Penetrate: '관통', Hit: '타격',
}
// The game's effect text colours on the site's palette (DESIGN.md: no neon; each colour keeps its meaning)
const TONE: Record<string, string> = {
  ebcaa2: '#e8dcc8', e30000: '#ec6a5e', ff0000: '#ec6a5e', fe4b48: '#ec6a5e', '80c9ff': '#8cc4ea', '00ff9c': '#7fd1a4',
  f8c200: '#e8b030', a16a3b: '#b0a890',
  // sin names: lib/constants/sin's colours; pride and envy a step lighter to read on the dark card
  fd6600: '#d06030', fecc2b: '#d4b830', '9eff00': '#88b028', '15c3ee': '#4898b0', '004bd5': '#5b8fd0', '9400dc': '#9a74c4',
}
// The same colours as ink on the check's paper plate (dark enough to read on the beige)
const INK: Record<string, string> = {
  ebcaa2: '#3a2a1a', e30000: '#a3261b', ff0000: '#a3261b', fe4b48: '#a3261b', '80c9ff': '#1f5f8c', '00ff9c': '#1d6b45',
  f8c200: '#8a5a00', a16a3b: '#5a4026', fd6600: '#a8440c', fecc2b: '#7f6000', '9eff00': '#4a7410', '15c3ee': '#1b6a86',
  '004bd5': '#1d4fb8', '9400dc': '#6a2fa0',
}

type ChoiceEvent = Extract<DungeonEvent, { kind: 'choice' }>
type CheckEvent = Extract<DungeonEvent, { kind: 'check' }>
/** A step of the story view, as the game goes: an event, a picked option's result, a check's outcome */
type Step = { t: 'event'; id: number } | { t: 'judge'; id: number } | { t: 'option'; id: number; idx: number } | { t: 'outcome'; id: number; side: 'success' | 'fail' }
type Ctx = { events: Record<string, DungeonEvent>; gifts: Record<string, DungeonEventGift>; lang: Lang; sub: StorySubchapter; base: string
  openGift: (id: string) => void; go: (step: Step) => void }
type Reward = { type?: string; rewardId?: number }

/** The game's TextMeshPro rich text (color, size, i, b, u, ruby, noparse; nested) as spans in the site's tones, line breaks kept.
 *  Anything else in angle brackets is not a tag to TextMeshPro either, so it stays as text. */
function Rich({ text, ink }: { text: string; ink?: boolean }) {
  const map = ink ? INK : TONE
  const re = /<noparse>([\s\S]*?)<\/noparse>|<ruby=("?)([^>]*?)\2>([\s\S]*?)<\/ruby>|<(\/?)(color|size|i|b|u)(?:=([^>]+))?>/g
  type Frame = { style?: CSSProperties; tag: string; kids: React.ReactNode[] }
  const stack: Frame[] = [{ tag: '', kids: [] }]
  const top = () => stack[stack.length - 1]
  let at = 0, k = 0, m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > at) top().kids.push(text.slice(at, m.index))
    at = m.index + m[0].length
    if (m[1] !== undefined) top().kids.push(m[1])
    else if (m[4] !== undefined) top().kids.push(<ruby key={k++}>{m[4]}<rt>{m[3]}</rt></ruby>)
    else if (m[5]) {  // a closing tag closes up to its own opener; a stray one is dropped
      const i = stack.findLastIndex(f => f.tag === m![6])
      while (i > 0 && stack.length > i) {
        const f = stack.pop()!
        top().kids.push(<span key={k++} style={f.style}>{f.kids}</span>)
      }
    } else {
      const [tag, v = ''] = [m[6], m[7]?.replace(/"/g, '')]
      const hex = /^#([0-9a-fA-F]{6})/.exec(v)?.[1]
      const style: CSSProperties = tag === 'color' ? { color: hex ? map[hex.toLowerCase()] ?? `#${hex}` : v }
        : tag === 'size' ? { fontSize: v.endsWith('%') ? `${parseFloat(v) / 100}em` : v.endsWith('em') ? v : undefined }
        : tag === 'i' ? { fontStyle: 'italic' } : tag === 'b' ? { fontWeight: 700 } : { textDecoration: 'underline' }
      stack.push({ tag, style, kids: [] })
    }
  }
  if (at < text.length) top().kids.push(text.slice(at))
  while (stack.length > 1) { const f = stack.pop()!; top().kids.push(<span key={k++} style={f.style}>{f.kids}</span>) }
  return <>{stack[0].kids}</>
}

/** A result's condition as a short label: a probability, a picked sinner; others (the game does not show them) none. */
function condLabel(cond: string, lang: Lang): string | null {
  const s = L[lang]
  const p = /^Prob_([\d.]+)$/.exec(cond)
  if (p) return Number(p[1]) >= 1 ? null : `${Math.round(Number(p[1]) * 100)}%`
  const u = /^ChooseUnit_([^:]+)(:Not)?$/.exec(cond)
  if (u) return u[2] ? s.otherwise : s.pick(u[1].split(',').map(n => SINNER_NAMES[n.toLowerCase()]?.[lang] ?? n).join(', '))
  return null
}

/** The gift ids a lock (cantSelectInThisCase: HasNotEgoGift_<ids>, HasNotEnoughEgoGift_<id>_<n>, HasNotEgoGiftList_<n>_<a:b>) asks for. */
const lockGifts = (lock?: string) => (lock && /EgoGift/.test(lock) ? [...new Set(lock.split('_').slice(1).join('_').match(/\d{3,}/g) ?? [])] : [])

export const giftArt = (id: string, g: DungeonEventGift, base: string, lang: Lang) => ({
  // no TIER_n tag in the game data (8장 items): no grade mark (GiftGrade shows I for a null grade)
  name: pickText(g.name, lang), grade: g.grade ?? '', keyword: g.keyword ? GIFT_KEYWORD[g.keyword] ?? null : null,
  image_url: local(`${base}/gift/${id}.webp`),
})

/** The site's gift window for an event gift: the game's name and effect text. */
export function EventGiftModal({ id, g, base, lang, onClose }: { id: string; g: DungeonEventGift; base: string; lang: Lang; onClose: () => void }) {
  return (
    <GiftDetailModal lang={lang} onClose={onClose} zIndex={90} gift={{
      name: pickText(g.name, lang), art: giftArt(id, g, base, lang), keyword: g.keyword ? GIFT_KEYWORD[g.keyword] ?? null : null,
      effects: [pickText(g.desc, lang) || null, null, null],
    }} />
  )
}

/** What an option can lead to, for the icons at its bar's end: the gifts it gives (not destroys), a battle, a check's sins. */
function reach(results: DungeonEventResult[], ctx: Ctx, seen: Set<number>, out = { gifts: new Set<string>(), battle: false, sins: new Set<string>() }) {
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
function monitorText(step: Step, ctx: Ctx): string {
  const ev = ctx.events[String(step.id)]
  if (!ev) return ''
  if (step.t === 'outcome' && ev.kind === 'check') {
    const side = step.side === 'success' ? ev.success : ev.failure
    // one text per branch in the data, often the same words: each once
    return [...new Set(side.text.map(t => pickText(t, ctx.lang)).filter(Boolean))].join('\n\n').replaceAll('{0}', L[ctx.lang].chosen)
  }
  return pickText(ev.desc, ctx.lang)
}

/** A section's title on the game's brushed bronze tag (the event window's 결과 / 선택지 band), an aside at the row's end. */
function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <h3 className="-ml-3 flex h-11 shrink-0 items-center gap-2 bg-[length:100%_100%] bg-no-repeat pl-7 pr-14 font-[family-name:var(--font-heading)] text-[1.25rem] leading-none text-[#fff1d8] [text-shadow:0_1px_2px_#000c]"
        style={{ backgroundImage: `url(${ui('tag')})` }}>{children}</h3>
      <span className="flex-1" />
      {aside}
    </div>
  )
}

/** The game's red button (5_17, lit 5_18 on hover, 5_21 pressed) with its words. */
function GameButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group relative inline-flex min-h-12 min-w-[10.5rem] items-center justify-center gap-1.5 px-7 pb-1.5 font-[family-name:var(--font-heading)] text-[1.0625rem] leading-none text-[#fff2dc] [text-shadow:0_1px_2px_#0009] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
      {(['button', 'button-hover', 'button-press'] as const).map((k, i) => (
        <span key={k} aria-hidden className={`absolute inset-0 transition-opacity duration-150 ${i === 0 ? '' : i === 1 ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 group-active:opacity-100'}`}
          style={nine(k, '65 65 75 65', '1rem 1rem 1.25rem 1rem')} />
      ))}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  )
}

/** The camera's running time on the monitor (00:MM:SS:cc), as the game's event window counts it from when it opens. */
function Timecode() {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const start = performance.now()
    const id = window.setInterval(() => setT(performance.now() - start), 50)
    return () => window.clearInterval(id)
  }, [])
  const cs = Math.floor(t / 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return <>{`00:${p(Math.floor(cs / 6000) % 60)}:${p(Math.floor(cs / 100) % 60)}:${p(cs % 100)}`}</>
}

/** The event monitor: brass housing, the picture under the camera's corners / REC / time, the scene text on the scan lines. */
function Monitor({ picSrc, picKey, text }: { picSrc: string | null; picKey: number | null; text: string }) {
  return (
    <section className={`flex min-h-0 flex-col ${picSrc == null ? 'self-start' : ''}`} style={nine('housing', '90', '1.5rem')}>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050403]">
        {picSrc != null && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={picKey} src={picSrc} alt="" className="story-panel-in aspect-[16/9] w-full shrink-0 object-cover [mask-image:linear-gradient(#000_78%,transparent)]" />
        )}
        {/* the camera's frame over the whole screen */}
        <div aria-hidden className="pointer-events-none absolute inset-3 z-10">
          {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c} src={ui(`corner-${c}`)} alt="" className={`absolute h-7 w-7 object-contain opacity-80 ${c[0] === 't' ? 'top-0' : 'bottom-0'} ${c[1] === 'l' ? 'left-0' : 'right-0'}`} />
          ))}
          <span className="absolute left-9 top-3.5 font-[family-name:var(--font-body)] text-[0.8125rem] tabular-nums tracking-[0.06em] text-[#e8e2d6] [text-shadow:0_1px_2px_#000]"><Timecode /></span>
          <span className="absolute right-9 top-4 flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ui('rec-dot')} alt="" className="h-2 w-2 motion-safe:animate-[event-rec_1.2s_steps(1)_infinite]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ui('rec')} alt="" className="h-3 w-auto opacity-90" />
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[length:100%_100%] px-7 pb-12 pt-4"
          style={{ backgroundImage: `url(${ui('scan')})` }}>
          <p key={text} className="story-panel-in whitespace-pre-line break-keep font-[family-name:var(--font-game-text)] text-[0.9375rem] leading-[1.85] text-[#efe6d6] [text-shadow:0_1px_2px_#000]"><Rich text={text} /></p>
        </div>
      </div>
    </section>
  )
}

/**
 * An EVENT room as the game's event window, full screen: on the left the event picture (ChoiceEvent_<id>) over the
 * scene text; on the right the options, each with what it can give at a glance, and the picked one's results in full.
 * "이야기 보기" follows the story as the game tells it, step by step; back steps out.
 */
export default function DungeonEventWindow({ events, gifts, pics, first, title, lang, sub, base, onClose }: {
  events: Record<string, DungeonEvent>; gifts?: Record<string, DungeonEventGift>; pics?: number[]; first: number; title: string
  lang: Lang; sub: StorySubchapter; base: string; onClose: () => void
}) {
  const s = L[lang]
  const [gift, setGift] = useState<string | null>(null)
  // phones take the half-size event picture (event/h); set after mount, so a server-drawn window matches at first
  // (null until then: no full-size picture is fetched first on a phone)
  const [small, setSmall] = useState<string | null>(null)
  useEffect(() => { setSmall(isTouch() ? 'h/' : '') }, [])
  const [steps, setSteps] = useState<Step[]>([{ t: 'event', id: first }])
  if (!events[String(first)]) return null
  const ctx: Ctx = { events, gifts: gifts ?? {}, lang, sub, base, openGift: setGift, go: st => setSteps(v => [...v, st]) }
  const g = gift ? ctx.gifts[gift] : null
  const step = steps[steps.length - 1]
  // the picture: the latest event on the way that has one
  const picId = [...steps].reverse().map(st => st.id).find(i => pics?.includes(i)) ?? null
  // the monitor's text: this step's, else the last one on the way that has some
  const text = [...steps].reverse().map(st => monitorText(st, ctx)).find(Boolean) ?? ''
  return (
    <>
      <BaseModal open onClose={onClose} title={title || s.title} maxWidth="min(120rem,98cqw)" zIndex={80}>
        <div className="flex h-[96cqh] flex-col bg-[var(--bg-deep)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            {steps.length > 1
              ? <button type="button" onClick={() => setSteps(v => v.slice(0, -1))} aria-label={s.back} className={buttonClass({ variant: 'ghost', iconOnly: true })}><ChevronLeft size={20} /></button>
              : <span className="w-11" />}
            <h2 className="min-w-0 flex-1 truncate text-center font-[family-name:var(--font-heading)] text-[1.25rem] leading-none text-[var(--text-primary)]">{title}</h2>
            <button type="button" onClick={onClose} aria-label={s.close} className={buttonClass({ variant: 'ghost', iconOnly: true })}><X size={20} /></button>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5 overflow-hidden p-4 @5xl:gap-8 @5xl:p-6">
            <Monitor picSrc={picId != null && small != null ? `${base}/event/${small}${picId}.webp` : null} picKey={picId} text={text} />
            <section key={steps.length} className="story-panel-in min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain py-1 pl-3 pr-2">
              <Side step={step} ctx={ctx} />
            </section>
          </div>
        </div>
      </BaseModal>
      {g && gift && <EventGiftModal id={gift} g={g} base={base} lang={lang} onClose={() => setGift(null)} />}
    </>
  )
}

function Side({ step, ctx }: { step: Step; ctx: Ctx }) {
  const s = L[ctx.lang]
  const ev = ctx.events[String(step.id)]
  if (!ev) return null
  if (step.t === 'event' && ev.kind === 'choice') return <Choices ev={ev} ctx={ctx} />
  if (step.t === 'event' && ev.kind === 'check') return (
    <>
      <SectionTitle aside={
        <button type="button" onClick={() => ctx.go({ t: 'judge', id: ev.id })} className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          {s.story}<ChevronRight size={16} aria-hidden />
        </button>
      }>{s.check}</SectionTitle>
      <CheckChain first={ev} ctx={ctx} seen={new Set()} boxed />
    </>
  )
  if (step.t === 'judge' && ev.kind === 'check') return <CheckStep ev={ev} ctx={ctx} />
  if (step.t === 'option' && ev.kind === 'choice') {
    const o = ev.options[step.idx]
    return (
      <>
        <SectionTitle>{s.result}</SectionTitle>
        {/* the picked option on its plate, as the game's result screen shows it */}
        <p className="mt-3 flex min-h-[4.25rem] items-center break-keep px-4 py-1.5 font-[family-name:var(--font-heading)] text-[1.125rem] leading-snug text-[#f6ead6]"
          style={nine('option', '45', '0.875rem')}><Rich text={pickText(o.text, ctx.lang)} /></p>
        <ResultBox className="mt-4"><Outcome results={o.results} ctx={ctx} seen={new Set([ev.id])} story /></ResultBox>
      </>
    )
  }
  if (step.t === 'outcome' && ev.kind === 'check') {
    const side = step.side === 'success' ? ev.success : ev.failure
    return (
      <>
        <SectionTitle>{s.result}</SectionTitle>
        <p className={`mt-3 flex min-h-[4.25rem] items-center px-4 py-1.5 font-[family-name:var(--font-heading)] text-[1.375rem] leading-none ${step.side === 'success' ? 'text-[var(--gold-light)]' : 'text-[var(--error-text)]'}`}
          style={nine('option', '45', '0.875rem')}>
          {step.side === 'success' ? s.success : s.fail}
        </p>
        <ResultBox className="mt-4"><Outcome results={side.results} ctx={ctx} seen={new Set([ev.id])} story /></ResultBox>
      </>
    )
  }
  return null
}

/** The options: a bar each (the game's choice text and hint; the icons of what it can give), the picked one's results
 * below in full. */
function Choices({ ev, ctx }: { ev: ChoiceEvent; ctx: Ctx }) {
  const s = L[ctx.lang]
  const [sel, setSel] = useState(0)
  const o = ev.options[sel]
  const needs = lockGifts(o.lock).filter(id => ctx.gifts[id])
  return (
    <>
      <SectionTitle>{s.choices}</SectionTitle>
      <div className="mt-3 space-y-2.5" role="tablist">
        {ev.options.map((opt, i) => {
          const on = i === sel
          const r = reach(opt.results, ctx, new Set([ev.id]))
          const gifts = [...r.gifts]
          return (
            <div key={i} className="relative pl-7">
              {/* the game's pointer (7_14, turned to point at the plate) on the picked option */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ui('pointer')} alt="" aria-hidden className={`absolute left-0 top-1/2 h-5 w-auto -translate-y-1/2 -scale-x-100 transition-[opacity,translate] duration-200 ease-out ${on ? 'opacity-100' : '-translate-x-1.5 opacity-0'}`} />
              <button type="button" role="tab" aria-selected={on} onClick={() => setSel(i)}
                className={`flex min-h-[4.25rem] w-full items-center gap-4 px-3 py-1.5 text-left transition-[filter] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] ${on ? 'brightness-110' : 'brightness-[.82] hover:brightness-100'}`}
                style={nine('option', '45', '0.875rem')}>
                <span className={`w-7 shrink-0 text-center font-[family-name:var(--font-title)] text-[1.75rem] leading-none ${on ? 'text-[var(--gold-light)]' : 'text-[#b9a27e]'}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-keep font-[family-name:var(--font-heading)] text-[1.0625rem] leading-snug text-[#f6ead6]"><Rich text={pickText(opt.text, ctx.lang)} /></span>
                  {pickText(opt.sub, ctx.lang) && <span className="mt-1 block break-keep text-[0.8125rem] leading-snug text-[#c9b597]"><Rich text={pickText(opt.sub, ctx.lang)} /></span>}
                </span>
                {/* at a glance: the check's sins, a battle, the gifts it can give */}
                <span className="flex shrink-0 items-center gap-1.5">
                  {lockGifts(opt.lock).length > 0 && <Lock size={14} aria-label={s.needs} className="text-[#c9b597]" />}
                  {[...r.sins].filter(x => SIN_ICON[x]).map(x => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={x} src={ui(SIN_ICON[x])} alt="" className="h-6 w-6 object-contain" />
                  ))}
                  {r.battle && <Swords size={17} aria-label={s.battle} className="text-[#ec6a5e]" />}
                  {gifts.slice(0, 4).map(id => (
                    <span key={id} className="relative block w-9">
                      <GiftArtwork gift={giftArt(id, ctx.gifts[id], ctx.base, ctx.lang)} displayName={pickText(ctx.gifts[id].name, ctx.lang)} sizes="36px" />
                    </span>
                  ))}
                  {gifts.length > 4 && <span className="font-[family-name:var(--font-title)] text-[1rem] leading-none text-[var(--gold-light)]">+{gifts.length - 4}</span>}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* the picked option's results in full */}
      <div key={sel} role="tabpanel" className="story-panel-in mt-7">
        <SectionTitle aside={
          <button type="button" onClick={() => ctx.go({ t: 'option', id: ev.id, idx: sel })} className={buttonClass({ variant: 'ghost', size: 'sm' })}>
            {s.story}<ChevronRight size={16} aria-hidden />
          </button>
        }>
          <span className="font-[family-name:var(--font-title)] text-[1.5rem] leading-none text-[var(--gold-light)]">{sel + 1}</span>{s.result}
        </SectionTitle>
        <ResultBox>
          {needs.length > 0 && (
            <div className="mb-1 flex items-center gap-3">
              <span className="flex gap-2">{needs.map(id => <Gift key={id} id={id} ctx={ctx} />)}</span>
              <span className="text-[0.8125rem] text-[var(--text-secondary)]">{s.needs}</span>
            </div>
          )}
          <Outcome results={o.results} ctx={ctx} seen={new Set([ev.id])} />
        </ResultBox>
      </div>
    </>
  )
}

/** The game's result box (8_0: halftone dark, brass edge) behind what a choice or a check gives. */
function ResultBox({ children, className = 'mt-3' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative px-6 pb-5 pt-3 ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-0" style={nine('result', '230 285 230 285', '2.25rem 2.75rem')} />
      <div className="relative">{children}</div>
    </div>
  )
}

/** A value box of the check panel (7_21) with its title on the bronze band: 성공 값 and the up / down arrow (7_32). */
function ValueBox({ label, value, arrow, dim }: { label: string; value: number; arrow?: 'up' | 'down'; dim?: boolean }) {
  return (
    <div className="relative flex min-w-[7.5rem] flex-col items-center px-4 pb-2.5 pt-2">
      <span aria-hidden className="pointer-events-none absolute inset-0" style={nine('value', '30', '0.5rem')} />
      <span className="relative bg-[length:100%_100%] bg-no-repeat px-4 py-0.5 font-[family-name:var(--font-heading)] text-[0.8125rem] leading-tight text-[#fff1d8] [text-shadow:0_1px_1px_#000a]"
        style={{ backgroundImage: `url(${ui('tag')})` }}>{label}</span>
      <span className={`relative mt-1 flex items-center gap-1.5 font-[family-name:var(--font-title)] text-[2.25rem] leading-none ${dim ? 'text-[#cbbfae]' : 'text-[#fff1d8]'} [text-shadow:0_2px_3px_#000b]`}>
        {value}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {arrow && <img src={ui('arrow-up')} alt="" className={`h-6 w-auto ${arrow === 'down' ? 'rotate-180' : ''}`} />}
      </span>
    </div>
  )
}

/** Tabs as the site's info windows draw them: words on one line, the chosen one in gold over a 2px rule. */
function Tabs({ tabs, value, onChange, small }: { tabs: { key: string; label: string; tone?: string }[]; value: string; onChange: (k: string) => void; small?: boolean }) {
  return (
    // small: tabs inside other tabs (a check's branches), without the full-width rule
    <div role="tablist" className={`flex flex-wrap ${small ? 'gap-x-4' : 'gap-x-5 border-b border-[var(--border)]'}`}>
      {tabs.map(t => {
        const on = t.key === value
        const tone = t.tone ?? 'var(--gold-light)'
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.key)}
            className={`-mb-px border-b-2 font-[family-name:var(--font-heading)] transition-colors ${small ? 'min-h-9 text-[0.8125rem]' : 'min-h-10 text-[0.9375rem]'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${on ? '' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            style={on ? { color: tone, borderColor: tone } : undefined}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * What results give: branches (by probability or the sinner picked) as tabs; the effect lines with gift cards and a
 * battle's enemies; a check that follows as its line with 판정 성공 / 판정 실패 as tabs; a choice that follows as a button
 * to it. story: the step view, where whatever follows is 다음으로.
 */
function Outcome({ results, ctx, seen, story, nested, chain }: { results: DungeonEventResult[]; ctx: Ctx; seen: Set<number>; story?: boolean; nested?: boolean
  /** the check chain this outcome sits in: a check of it that follows is named (판정 N), not drawn again */
  chain?: Map<number, number> }) {
  const s = L[ctx.lang]
  const [at, setAt] = useState(0)
  const r = results[Math.min(at, results.length - 1)]
  if (!r) return null
  const lines = (r.effects ?? []).filter(f => pickText(f.text, ctx.lang))
  const inChain = !story && r.next != null ? chain?.get(r.next) : undefined
  const next = inChain == null && r.next != null && !seen.has(r.next) ? ctx.events[String(r.next)] : undefined
  return (
    <div className="mt-3">
      {results.length > 1 && (
        <Tabs tabs={results.map((x, i) => ({ key: String(i), label: condLabel(x.cond, ctx.lang) ?? String(i + 1) }))} value={String(at)} onChange={k => setAt(Number(k))} small={nested} />
      )}
      <div key={at}>
        {lines.length > 0 && (
          <ul className="mt-3 space-y-2.5 font-[family-name:var(--font-game-text)] text-[0.875rem] leading-snug text-[var(--text-primary)]">
            {lines.map((f, k) => <Effect key={k} f={f} ctx={ctx} />)}
          </ul>
        )}
        {next && story && (
          <div className="mt-6 flex justify-end">
            <GameButton onClick={() => ctx.go({ t: next.kind === 'check' ? 'judge' : 'event', id: next.id })}>{s.next}</GameButton>
          </div>
        )}
        {inChain != null && (
          <p className="mt-2.5 flex items-center gap-1 font-[family-name:var(--font-heading)] text-[0.8125rem] text-[var(--text-secondary)]">
            <ChevronRight size={14} aria-hidden />{s.toCheck(inChain)}
          </p>
        )}
        {next && !story && next.kind === 'check' && <div className="mt-5"><CheckChain first={next} ctx={ctx} seen={seen} /></div>}
        {next && !story && next.kind === 'choice' && (
          <button type="button" onClick={() => ctx.go({ t: 'event', id: next.id })} className={`mt-3 ${buttonClass({ variant: 'outline', size: 'sm' })}`}>
            {s.more(next.options.length)}<ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

/** A check's line (PersonalityChoiceEventJudgementTitleUI): the sins' icons, 유리 / 불리 판정 with the sins, 성공 값
 * (inclusiveValue for those sins, exclusiveValue for any other) with its up / down arrow; the bonuses under it. */
function CheckLine({ ev, ctx }: { ev: CheckEvent; ctx: Ctx }) {
  const s = L[ctx.lang]
  const j = ev.judge
  const up = (j.upDownType ?? 1) > 0
  return (
    <div>
      {/* the game's paper plate (5_20): the sins and 유리 / 불리 판정, the question under it */}
      <div className="relative px-7 pb-4 pt-3.5 text-center">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={nine('paper', '120', '1.75rem')} />
        <p className="relative flex items-center justify-center gap-2 font-[family-name:var(--font-heading)] text-[1.3125rem] leading-none text-[#2b1d12]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ev.sins.filter(x => SIN_ICON[x]).map(x => <img key={x} src={ui(SIN_ICON[x])} alt="" className="h-8 w-8 object-contain" />)}
          <Rich text={pickText(ev.judgeText, ctx.lang)} ink />
        </p>
        {pickText(ev.behave, ctx.lang) && <p className="relative mt-2 break-keep font-[family-name:var(--font-game-text)] text-[0.9375rem] leading-snug text-[#3b2a1c]"><Rich text={pickText(ev.behave, ctx.lang)} ink /></p>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <ValueBox label={s.threshold} value={j.inclusiveValue} arrow={up ? 'up' : 'down'} />
        {j.exclusiveValue != null && j.exclusiveValue !== j.inclusiveValue && ev.sins.length > 0 && <ValueBox label={s.others} value={j.exclusiveValue} dim />}
        {ev.bonus.length > 0 && (
          <ul className="ml-2 space-y-1 text-[0.8125rem] leading-snug text-[var(--text-secondary)]">
            {ev.bonus.map((b, i) => <li key={i}><Rich text={pickText(b.text, ctx.lang)} /></li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

/** The checks that follow one another from a first one (what either outcome leads to), in the order the game runs them. */
function checkChain(first: CheckEvent, ctx: Ctx, seen: Set<number>): CheckEvent[] {
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

/**
 * Checks as the game runs them, one after another (ChoiceEventController: a Sinner is picked for each, their Identity's
 * skill rolls against 성공 값, 다음으로 to the next): each check's line, then what 판정 성공 and 판정 실패 give side by
 * side; an outcome that goes on to a later check names it (판정 N).
 */
function CheckChain({ first, ctx, seen, boxed }: { first: CheckEvent; ctx: Ctx; seen: Set<number>
  /** the window's own check (not inside an option's result box): its outcomes get the result box */
  boxed?: boolean }) {
  const s = L[ctx.lang]
  const list = checkChain(first, ctx, seen)
  const index = new Map(list.map((ev, i) => [ev.id, i + 1]))
  const all = new Set([...seen, ...list.map(ev => ev.id)])
  const outcomes = (ev: CheckEvent) => (
    <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
      {(['success', 'fail'] as const).map(side => (
        <div key={side} className={`min-w-0 ${side === 'success' ? 'pr-5' : 'pl-5'}`}>
          <p className={`pt-1 font-[family-name:var(--font-heading)] text-[1rem] leading-none ${side === 'success' ? 'text-[var(--gold-light)]' : 'text-[var(--error-text)]'}`}>
            {side === 'success' ? s.success : s.fail}
          </p>
          <Outcome results={(side === 'success' ? ev.success : ev.failure).results} ctx={ctx} seen={all} chain={index} nested />
        </div>
      ))}
    </div>
  )
  return (
    <div className="mt-3">
      <p className="break-keep text-[0.8125rem] leading-snug text-[var(--text-secondary)]">{s.howCheck}</p>
      <ol className="mt-5 space-y-8">
        {list.map((ev, i) => (
          <li key={ev.id}>
            {list.length > 1 && (
              <p className="mb-2.5 flex items-baseline gap-1.5 font-[family-name:var(--font-heading)] text-[0.9375rem] leading-none text-[var(--text-secondary)]">
                {s.check}<span className="font-[family-name:var(--font-title)] text-[1.5rem] text-[var(--gold-light)]">{i + 1}</span>
                <span className="font-[family-name:var(--font-title)] text-[1rem] text-[var(--text-muted)]">/ {list.length}</span>
              </p>
            )}
            <CheckLine ev={ev} ctx={ctx} />
            {boxed ? <ResultBox className="mt-3">{outcomes(ev)}</ResultBox> : <div className="mt-4">{outcomes(ev)}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** A check as a story step: the game's prompt to pick the Identity, the check's line, and the two outcomes to follow. */
function CheckStep({ ev, ctx }: { ev: CheckEvent; ctx: Ctx }) {
  const s = L[ctx.lang]
  return (
    <>
      <SectionTitle>{s.check}</SectionTitle>
      <div className="mt-3"><CheckLine ev={ev} ctx={ctx} /></div>
      <p className="mt-5 font-[family-name:var(--font-heading)] text-[1rem] text-[var(--text-primary)]">{s.pickSinner}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <GameButton onClick={() => ctx.go({ t: 'outcome', id: ev.id, side: 'success' })}>{s.ifSuccess}</GameButton>
        <GameButton onClick={() => ctx.go({ t: 'outcome', id: ev.id, side: 'fail' })}>{s.ifFail}</GameButton>
      </div>
    </>
  )
}

/** A gift as the site's gift card; pressing it opens the gift's effect window. */
function Gift({ id, ctx, size = '3rem' }: { id: string; ctx: Ctx; size?: string }) {
  const g = ctx.gifts[id]
  if (!g) return null
  const name = pickText(g.name, ctx.lang)
  return <GiftCard gift={giftArt(id, g, ctx.base, ctx.lang)} onClick={() => ctx.openGift(id)} size={size} showName={false} ariaLabel={name} title={name} />
}

/** One effect line in the game's words; a gift it gives or takes as its card (press for its effect), a battle's enemies. */
function Effect({ f, ctx }: { f: DungeonEventEffect; ctx: Ctx }) {
  const reward = f.itemReward as Reward | undefined
  const gid = reward?.type === 'EGO_GIFT' && reward.rewardId != null && ctx.gifts[String(reward.rewardId)] ? String(reward.rewardId) : null
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {gid && <Gift id={gid} ctx={ctx} />}
      <span className="min-w-0"><Rich text={pickText(f.text, ctx.lang)} /></span>
      {f.battle && <Battle effect={f} ctx={ctx} />}
    </li>
  )
}

/** A battle an effect starts: its enemies as small portrait cards in the stage panel's bronze frame (names on hover). */
function Battle({ effect, ctx }: { effect: DungeonEventEffect; ctx: Ctx }) {
  const s = L[ctx.lang]
  const units = [...new Map((effect.battle?.waves ?? []).flat().filter(u => !u.hidden).map(u => [u.id, u])).values()]
  if (!units.length) return null
  return (
    <ul aria-label={s.battle} className="flex flex-wrap gap-1.5">
      {units.map(u => {
        const e = ctx.sub.enemies[String(u.id)]
        const name = pickText(e?.name, ctx.lang) || '???'
        return (
          <li key={u.id} className="w-10" title={name}>
            <div className="relative aspect-[279/361]">
              <div className="absolute inset-[5%] overflow-hidden bg-[var(--bg-card)]">
                {e?.portrait
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`${ctx.base}/portrait/${e.portrait}.webp`} alt={name} loading="lazy" className="absolute left-1/2 top-[-4%] h-[170%] w-auto max-w-none -translate-x-1/2" />
                  : <span className="flex h-full items-center justify-center font-[family-name:var(--font-title)] text-[1rem] text-[var(--text-muted)]">?</span>}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${ctx.base}/ui/enemy-frame.webp`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
