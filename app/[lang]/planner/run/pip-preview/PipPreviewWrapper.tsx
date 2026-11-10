'use client'

import { useMemo, useState } from 'react'
import CompanionView, { type PipActions, type PipView } from '@/features/planner/components/CompanionView'
import { giftBadges } from '@/lib/planner/pip-view'
import type { GiftData, ThemeData } from '@/lib/planner/types'
import type { MdEvent, MdEventChoice } from '@/features/mirror-dungeon'

/** The window sizes the preview draws each view at: the smallest the PiP allows, its default, a tall one and a wide one. */
const SIZES = [
  { width: 320, height: 280, label: '최소 320×280' },
  { width: 380, height: 420, label: '기본 380×420' },
  { width: 480, height: 640, label: '세로 480×640' },
  { width: 640, height: 420, label: '가로 640×420' },
]

type Scenario = { key: string; label: string; view: (owned: ReadonlySet<number>) => PipView }

/**
 * Development preview of the Assist PiP: each view (floor, pack choice, ? room, run start) built from real gifts and a
 * real pack, drawn by the same CompanionView the PiP uses, at every size in SIZES. Clicking a gift marks it owned here.
 */
export default function PipPreviewWrapper({ themes, gifts, events, eventChoices }: { themes: ThemeData[]; gifts: GiftData[]; events: MdEvent[]; eventChoices: MdEventChoice[] }) {
  const giftMap = useMemo(() => new Map(gifts.map(gift => [gift.game_id, gift])), [gifts])
  const [owned, setOwned] = useState<Set<number>>(new Set())
  const [scenario, setScenario] = useState('floor')

  const scenarios = useMemo<Scenario[]>(() => {
    // A pack with its own gifts (floor-only) and art, and its gift list as the floor's gifts.
    const theme = themes.find(item => (item.specific_ego_gift_ids?.length ?? 0) >= 4 && item.image_url) ?? themes[0]
    if (!theme) return []
    const own = (theme.specific_ego_gift_ids ?? []).filter(id => giftMap.has(id))
    const general = (theme.ego_gift_ids ?? []).filter(id => giftMap.has(id) && !own.includes(id))
    const floorIds = [...own, ...general].slice(0, 24)
    const plannedIds = new Set([...own.slice(0, 3), ...general.slice(0, 2)])
    const finalIds = new Set(general.slice(2, 4))
    const bonus = [own[1], own[2], own[3], general[5]].filter((id): id is number => id !== undefined)
    const giftsOf = (ids: number[]) => ids.flatMap(id => giftMap.get(id) ?? [])
    const all = giftsOf(floorIds)
    const rows = [
      { ids: plannedIds, badge: { key: 'plan', label: '플랜에 설정한 기프트', tone: 'plan' as const } },
      { ids: new Set(own), badge: { key: 'floor-only', label: '이 층에서만 얻을 수 있음', tone: 'warn' as const } },
      { ids: new Set(bonus), badge: { key: 'clear-bonus', label: '클리어 보너스', short: '보너스', tone: 'info' as const } },
    ]
    const base = (mode: PipView['mode'], have: ReadonlySet<number>): PipView => ({
      mode, floor: 3, theme, tips: [], owned: have, planned: new Set([...plannedIds, ...finalIds]),
      badges: id => giftBadges(id, rows),
      gifts: { all: all.filter(gift => !have.has(gift.game_id)), groups: [
        { key: 'planned', label: '이 층 계획', list: all.filter(gift => plannedIds.has(gift.game_id) && !have.has(gift.game_id)) },
        { key: 'final', label: '최종 목표', list: all.filter(gift => finalIds.has(gift.game_id) && !have.has(gift.game_id)) },
        { key: 'others', label: '나머지', list: all.filter(gift => !plannedIds.has(gift.game_id) && !finalIds.has(gift.game_id) && !have.has(gift.game_id)) },
      ].filter(group => group.list.length) },
    })
    const event = events.find(item => eventChoices.some(choice => choice.event_id === item.id))
    return [
      { key: 'floor', label: '층 화면 (노말: 보너스 1개)', view: have => ({ ...base('floor', have), memo: '3층: 상점에서 화상 기프트 위주로 산다.',
        tips: [{ kind: 'clear-bonus', gifts: bonus, picks: 1 }] }) },
      { key: 'floor-hard', label: '층 화면 (하드: 보너스 2개)', view: have => ({ ...base('floor', have), tips: [{ kind: 'clear-bonus', gifts: bonus, picks: 2 }] }) },
      { key: 'floor-plain', label: '층 화면 (보너스 못 읽음)', view: have => base('floor', have) },
      { key: 'pack', label: '테마팩 선택', view: have => ({ ...base('pack-choice', have), theme: undefined,
        pack: { guidance: { theme, fallbacks: [], availableFloors: [3, 4], feasible: true, remainingOrder: [], plannedHere: true }, gifts: giftsOf([...plannedIds]) },
        tips: [{ kind: 'clear-bonus-offer', picks: 1, cards: [
          { place: 648, index: 0, gifts: bonus, themeId: String(theme.id) },
          { place: 1280, index: 2, gifts: [general[0], general[7], general[8]].filter((id): id is number => id !== undefined), themeId: null },
        ] }] }) },
      { key: 'pack-blank', label: '테마팩 선택 (계획 없음)', view: have => ({ ...base('pack-choice', have), theme: undefined, pack: null }) },
      ...(event ? [{ key: 'event', label: '선택지 방', view: (have: ReadonlySet<number>) => ({ ...base('event', have), eventId: event.id }) }] : []),
      { key: 'start', label: '런 시작 (시작·관측 기프트)', view: have => ({ ...base('start', have), memo: '시작 기프트는 화상으로.',
        start: { start: giftsOf(general.slice(0, 3)), observe: giftsOf(own.slice(0, 2)) } }) },
    ]
  }, [themes, giftMap, events, eventChoices])

  const current = scenarios.find(item => item.key === scenario) ?? scenarios[0]
  const actions: PipActions = {
    acquire: id => setOwned(have => { const next = new Set(have); if (next.has(id)) next.delete(id); else next.add(id); return next }),
    chooseTheme: () => {}, undo: () => setOwned(new Set()), redo: () => {}, canUndo: owned.size > 0, canRedo: false,
  }
  if (!current) return <p className="p-6">테마팩 데이터가 없습니다.</p>
  return <main className="min-h-dvh bg-[var(--bg-deep)] p-4 text-[var(--text-primary)]">
    <h1 className="mb-1 font-[family-name:var(--font-heading)] text-xl text-[var(--gold-light)]">PiP 미리보기</h1>
    <p className="mb-3 text-sm text-[var(--text-secondary)]">개발 서버에서만 열린다. 어시스트 PiP와 같은 화면 컴포넌트를 창 크기별로 그린다. 기프트를 누르면 보유로 바뀌고, 되돌리기는 모두 지운다.</p>
    <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">{scenarios.map(item =>
      <button key={item.key} type="button" role="tab" aria-selected={item.key === current.key} onClick={() => setScenario(item.key)}
        className={`min-h-9 rounded-md border px-3 text-sm ${item.key === current.key ? 'border-[var(--gold)] text-[var(--gold-light)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>{item.label}</button>)}
    </div>
    <div className="flex flex-wrap items-start gap-4">{SIZES.map(size => <figure key={size.label} className="m-0">
      <figcaption className="mb-1 text-xs text-[var(--text-tertiary)]">{size.label}</figcaption>
      <div data-pip-preview={size.label} className="overflow-y-auto rounded border border-[var(--border)]" style={{ width: size.width, height: size.height, scrollbarGutter: 'stable' }}>
        <div className="min-h-full bg-[var(--bg-deep)] p-3 text-[var(--text-primary)]">
          <CompanionView view={current.view(owned)} data={{ giftMap, themes, events, eventChoices, skills: [] }} actions={actions} width={size.width} height={size.height} />
        </div>
      </div>
    </figure>)}</div>
  </main>
}
