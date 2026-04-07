'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import GiftCard from '@/components/ui/GiftCard'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type {
  MdEvent,
  MdEventChoice,
  ChoiceEffect,
  EgoGift,
  EgoGiftTheme,
} from '@/components/mirror-dungeon/types'
import {
  colorizeEventText,
  replaceEventPlaceholders,
  parseUnityColorTags,
} from '@/lib/utils/event-text'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'

// ── Types ────────────────────────────────────────────────────────────────────

interface EventModalProps {
  event: MdEvent
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  themes: EgoGiftTheme[]
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
}

// ── Sin color helper ─────────────────────────────────────────────────────────

function getSinColor(sinKr: string): string {
  const en = SIN_KR_TO_EN[sinKr]
  return en ? SIN_COLORS[en] : '#aaa'
}

// English color names used in message_desc → Korean sin names
const COLOR_TO_KR: Record<string, string> = {
  CRIMSON: '분노',
  SCARLET: '색욕',
  ORANGE: '색욕',
  VIOLET: '질투',
  INDIGO: '오만',
  AZURE: '우울',
  GREEN: '탐식',
  SHAMROCK: '탐식',
  YELLOW: '나태',
  AMBER: '나태',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripSizeTags(text: string): string {
  return text.replace(/<size=[^>]*>/g, '').replace(/<\/size>/g, '')
}

/**
 * Extract condition from message_desc and return a human-readable string.
 * Returns null if the condition is absent or unrecognizable (hide gracefully).
 */
function formatCondition(raw: string, giftByGameId: Map<number, EgoGift>): string | null {
  const m = raw.match(/\[조건: ([^\]]+)\]/)
  if (!m) return null
  const cond = m[1].trim()

  // HasNotEgoGift_XXXX
  const singleGift = cond.match(/^HasNotEgoGift_(\d+)$/)
  if (singleGift) {
    const gift = giftByGameId.get(Number(singleGift[1]))
    if (!gift) return null
    return `E.G.O 기프트 「${gift.name}」 보유 시 선택 가능`
  }

  // HasNotEgoGiftList_N_XXXX:YYYY:...
  const listGift = cond.match(/^HasNotEgoGiftList_\d+_(.+)$/)
  if (listGift) {
    const ids = listGift[1].split(':').map(Number)
    const names = ids
      .map(id => giftByGameId.get(id)?.name)
      .filter((n): n is string => Boolean(n))
    if (names.length === 0) return null
    return `E.G.O 기프트 「${names.join('」 또는 「')}」 보유 시 선택 가능`
  }

  // HasNotEnoughCost_N
  const cost = cond.match(/^HasNotEnoughCost_(\d+)$/)
  if (cost) {
    return `코스트 ${cost[1]} 이상 시 선택 가능`
  }

  return null
}

/** Strip [조건: ...] tag from message_desc for clean display */
function stripConditionTag(text: string): string {
  return text.replace(/\[조건: [^\]]+\]/g, '').trim()
}

/** Format a probability string to a human-readable percentage, or null for 100% */
function formatProb(prob: string | null | undefined): string | null {
  if (!prob || prob === 'Prob_1' || prob === '1') return null
  const m = prob.match(/^Prob_([\d.]+)$/)
  if (m) return `${Math.round(parseFloat(m[1]) * 100)}%`
  const n = parseFloat(prob)
  if (!isNaN(n) && n > 0 && n <= 1) return `${Math.round(n * 100)}%`
  return prob
}

// ── Effect renderer (sentence style) ─────────────────────────────────────────

const SIN_NAME: Record<string, string> = {
  CRIMSON: '분노', SCARLET: '색욕', ORANGE: '색욕',
  VIOLET: '질투', INDIGO: '오만', AZURE: '우울',
  GREEN: '탐식', SHAMROCK: '탐식', YELLOW: '나태', AMBER: '나태',
}

function sinList(raw: string): string {
  return raw.split(',').map(s => SIN_NAME[s.trim()] ?? s.trim()).join('·')
}

function formatTarget(raw: string): string | null {
  if (!raw) return null
  // strip condition suffix (|SUCCESS, |FAILURE, |IncludeSkillAttribute_*)
  const parts = raw.split('|')
  const target = parts[0]

  if (target === 'ChosenPersonality') return '선택한 인격'
  if (target === 'RandomPersonality') return '랜덤 인격'
  if (target === 'OnePersonality') return '인격 1명'
  if (target === 'NotAffectedAlly') return '이상 없는 아군'

  // RandomAlly_N
  const randomAlly = target.match(/^RandomAlly_(\d+)$/)
  if (randomAlly) return `랜덤 아군 ${randomAlly[1]}명`

  // LowestHpAlly_N
  const lowestHp = target.match(/^LowestHpAlly_(\d+)$/)
  if (lowestHp) return `체력이 가장 낮은 아군 ${lowestHp[1]}명`

  // LowestMpAlly_N
  const lowestMp = target.match(/^LowestMpAlly_(\d+)$/)
  if (lowestMp) return `정신력이 가장 낮은 아군 ${lowestMp[1]}명`

  // IncludeSkillAttribute_SIN[,SIN]
  const includeAttr = target.match(/^IncludeSkillAttribute_(.+)$/)
  if (includeAttr) return `${sinList(includeAttr[1])} 속성 공격 스킬 보유 인격`

  // NotIncludeSkillAttribute_SIN[,SIN]
  const excludeAttr = target.match(/^NotIncludeSkillAttribute_(.+)$/)
  if (excludeAttr) return `${sinList(excludeAttr[1])} 속성 공격 스킬 미보유 인격`

  // AttributePersonality_SIN (legacy pattern)
  const attrPersonality = target.match(/^AttributePersonality_(\w+)$/)
  if (attrPersonality) return `${SIN_NAME[attrPersonality[1]] ?? attrPersonality[1]} 속성 인격`

  // Named character targets (Ryosyu, Donquixote etc.) — show as-is
  if (/^[A-Z]/.test(target)) return target

  return null
}

interface EffectLineProps {
  effect: ChoiceEffect
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
}

function EffectLine({ effect, giftByGameId, onSelectGift }: EffectLineProps) {
  const red = '#e05050'
  const green = '#00c87a'
  const gold = '#c8900a'
  const muted = '#605850'

  const lineStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    lineHeight: 1.55,
    color: '#bbb0a0',
  }

  if (effect.type === 'gift' || effect.type === 'gift_battle') {
    const gift = effect.gift_id ? giftByGameId.get(effect.gift_id) : null
    if (!gift) return null
    return (
      <div style={{ position: 'relative', zIndex: 0, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', maxWidth: '5rem' }}>
        <GiftCard
          gift={gift}
          onClick={() => onSelectGift(gift)}
          size="3rem"
          showName={true}
        />
      </div>
    )
  }

  if (effect.type === 'cost') {
    return (
      <p style={{ ...lineStyle, color: gold, fontWeight: 700 }}>
        코스트 {effect.amount} 획득
      </p>
    )
  }

  if (effect.type === 'cost_loss') {
    return (
      <p style={{ ...lineStyle, color: red }}>
        코스트 {effect.amount} 소모
      </p>
    )
  }

  const targetText = effect.effect ? formatTarget(effect.effect) : null
  const subject = targetText ?? '아군 전원'

  if (effect.type === 'hp_loss') {
    const val = effect.hp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: red }}>
        {val === -1 ? `${subject} 체력 전소모` : `${subject} 체력 ${val} 피해`}
      </p>
    )
  }

  if (effect.type === 'mp_loss') {
    const val = effect.mp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: red }}>
        {val === -1 ? `${subject} 정신력 전소모` : `${subject} 정신력 ${val} 피해`}
      </p>
    )
  }

  if (effect.type === 'hp_mp_loss') {
    return (
      <p style={{ ...lineStyle, color: red }}>
        {effect.hp != null && effect.mp != null
          ? `${subject} 체력 ${effect.hp}, 정신력 ${effect.mp} 피해`
          : `${subject} 체력·정신력 ${effect.amount} 피해`}
      </p>
    )
  }

  if (effect.type === 'hp_loss_ratio') {
    return (
      <p style={{ ...lineStyle, color: red }}>
        {subject} {effect.amount}%만큼 체력 피해
      </p>
    )
  }

  if (effect.type === 'hp_recover') {
    const val = effect.hp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: green }}>
        {val === -1 ? `${subject} 체력 전회복` : `${subject} 체력 ${val} 회복`}
      </p>
    )
  }

  if (effect.type === 'mp_recover') {
    const val = effect.mp ?? effect.amount
    return (
      <p style={{ ...lineStyle, color: green }}>
        {val === -1 ? `${subject} 정신력 전회복` : `${subject} 정신력 ${val} 회복`}
      </p>
    )
  }

  if (effect.type === 'hp_mp_recover') {
    return (
      <p style={{ ...lineStyle, color: green }}>
        {effect.hp != null && effect.mp != null
          ? `${subject} 체력 ${effect.hp}, 정신력 ${effect.mp} 회복`
          : `${subject} 체력·정신력 ${effect.amount} 회복`}
      </p>
    )
  }

  if (effect.type === 'hp_recover_ratio') {
    return (
      <p style={{ ...lineStyle, color: green }}>
        {subject} {effect.amount}%만큼 체력 회복
      </p>
    )
  }

  if (effect.type === 'battle' || effect.type === 'battle_abnormality') {
    return (
      <p style={{ ...lineStyle, color: red, fontWeight: 700 }}>전투 발생!</p>
    )
  }

  if (effect.type === 'nothing') {
    return (
      <p style={{ ...lineStyle, color: muted }}>아무 일도 일어나지 않았다.</p>
    )
  }

  if (effect.type === 'level_up') {
    return (
      <p style={{ ...lineStyle, color: gold }}>인격 레벨 업!</p>
    )
  }

  if (effect.type === 'get_character') {
    return (
      <p style={{ ...lineStyle, color: gold }}>수감자 영입!</p>
    )
  }

  // destroy_gift
  if (effect.type === 'destroy_gift') {
    return (
      <p style={{ ...lineStyle, color: red }}>E.G.O 기프트 파괴</p>
    )
  }

  return null
}

// ── Effects list renderer ─────────────────────────────────────────────────────

function EffectsList({
  effects,
  giftByGameId,
  onSelectGift,
}: {
  effects: ChoiceEffect[]
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
}) {
  if (!effects || effects.length === 0) return null
  const normalGifts = effects.filter(e => e.type === 'gift')
  const battleGifts = effects.filter(e => e.type === 'gift_battle')
  const otherEffects = effects.filter(e => e.type !== 'gift' && e.type !== 'gift_battle')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem', marginTop: '0.5rem' }}>
      {otherEffects.map((eff, i) => (
        <EffectLine key={`o-${i}`} effect={eff} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
      ))}
      {battleGifts.length > 0 && (
        <div style={{ marginTop: '0.25rem' }}>
          <p style={{ fontSize: '0.6875rem', color: '#00c87a', marginBottom: '0.375rem' }}>
            다음 전투 승리 시 획득
          </p>
          <div style={{ position: 'relative', zIndex: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {battleGifts.map((eff, i) => (
              <EffectLine key={`bg-${i}`} effect={eff} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
            ))}
          </div>
        </div>
      )}
      {normalGifts.length > 0 && (
        <div style={{ position: 'relative', zIndex: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
          {normalGifts.map((eff, i) => (
            <EffectLine key={`g-${i}`} effect={eff} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Narration block ───────────────────────────────────────────────────────────

function NarrationText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div
      style={{
        paddingLeft: '0.875rem',
        borderLeft: '2px solid rgba(255,255,255,0.07)',
        marginTop: '0.5rem',
      }}
    >
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            color: '#807060',
            fontSize: '0.8125rem',
            lineHeight: 1.75,
            minHeight: line.length === 0 ? '0.5rem' : undefined,
          }}
        >
          {line.length > 0 ? colorizeEventText(replaceEventPlaceholders(line)) : '\u00A0'}
        </p>
      ))}
    </div>
  )
}

// ── Coin event block (success/failure branches) ───────────────────────────────

interface CoinEventProps {
  coinEvent: MdEvent
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth: number
}

function CoinEventBlock({
  coinEvent,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth,
}: CoinEventProps) {
  if (depth > 5) return null
  const branches = choicesByEventId.get(coinEvent.id) ?? []
  const successBranch = branches.find(c => c.sort_order === 0)
  const failureBranch = branches.find(c => c.sort_order === 1)

  // Parse sin/threshold from behaveDesc stored in coinEvent.desc_text
  // Format: "분노/색욕 판정 XX+" or similar
  const judgeText = coinEvent.desc_text
    ? replaceEventPlaceholders(stripSizeTags(coinEvent.desc_text))
    : null

  // Extract sin types from message_desc of branches: [SINCOLOR/sinKR 판정 min~max]
  // sm[1] may be an English color name (e.g. AMBER), sm[2] may also be English or Korean
  const sinInfo: { name: string; color: string }[] = []
  for (const branch of branches) {
    if (!branch.message_desc) continue
    const sinMatches = branch.message_desc.matchAll(/\[([^/\]]+)\/([^\s\]]+)\s/g)
    for (const sm of sinMatches) {
      const raw1 = sm[1]
      const raw2 = sm[2]
      const sinKr1 = COLOR_TO_KR[raw1] ?? raw1
      const sinKr2 = COLOR_TO_KR[raw2] ?? raw2
      for (const sinKr of [sinKr1, sinKr2]) {
        const color = getSinColor(sinKr)
        if (!sinInfo.find(s => s.name === sinKr)) {
          sinInfo.push({ name: sinKr, color })
        }
      }
    }
  }

  // Extract threshold value (e.g., "20+" or "30~50")
  let threshold = ''
  for (const branch of branches) {
    if (!branch.message_desc) continue
    const tMatch = branch.message_desc.match(/\s(\d+[+~\d]*)[\]$]/)
    if (tMatch) { threshold = tMatch[1]; break }
    // simpler: last number-like token in bracket
    const bracketContent = branch.message_desc.match(/\[([^\]]+)\]/)
    if (bracketContent) {
      const numMatch = bracketContent[1].match(/(\d+\+?)$/)
      if (numMatch) { threshold = numMatch[1]; break }
    }
  }

  return (
    <div
      style={{
        marginTop: '0.625rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(200,144,10,0.18)',
        overflow: 'hidden',
      }}
    >
      {/* Coin event header */}
      <div
        style={{
          padding: '0.625rem 0.875rem',
          background: 'rgba(200,144,10,0.07)',
          borderBottom: '1px solid rgba(200,144,10,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        {judgeText && (
          <span style={{ color: '#d4a020', fontSize: '0.8125rem', fontWeight: 600, flex: 1, minWidth: 0 }}>
            {colorizeEventText(judgeText)}
          </span>
        )}
        {sinInfo.length > 0 && (
          <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
            {sinInfo.map((s, i) => (
              <span key={s.name}>
                {i > 0 && <span style={{ color: '#666', margin: '0 0.125rem' }}>/</span>}
                <span style={{ color: s.color, fontWeight: 700, fontSize: '0.75rem' }}>{s.name}</span>
              </span>
            ))}
          </span>
        )}
        {threshold && (
          <span
            style={{
              color: '#c8900a',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: '0.875rem',
              flexShrink: 0,
            }}
          >
            {threshold}
          </span>
        )}
      </div>

      {/* Branches */}
      <div style={{ padding: '0.625rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {successBranch && (
          <BranchBlock
            choice={successBranch}
            isSuccess={true}
            eventById={eventById}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            onSelectGift={onSelectGift}
            depth={depth}
          />
        )}
        {failureBranch && (
          <BranchBlock
            choice={failureBranch}
            isSuccess={false}
            eventById={eventById}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            onSelectGift={onSelectGift}
            depth={depth}
          />
        )}
      </div>
    </div>
  )
}

// ── Branch block (success / failure) ─────────────────────────────────────────

interface BranchBlockProps {
  choice: MdEventChoice
  isSuccess: boolean
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth: number
}

function BranchBlock({
  choice,
  isSuccess,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth,
}: BranchBlockProps) {
  if (depth > 5) return null
  const accentColor = isSuccess ? '#00c87a' : '#e05050'
  const accentBg = isSuccess ? 'rgba(0,200,122,0.06)' : 'rgba(224,80,80,0.06)'
  const accentBorder = isSuccess ? 'rgba(0,200,122,0.18)' : 'rgba(224,80,80,0.18)'
  const label = isSuccess ? '성공' : '실패'

  const childEvent = choice.next_event_id ? eventById.get(choice.next_event_id) : null

  return (
    <div
      style={{
        borderRadius: '0.375rem',
        border: `1px solid ${accentBorder}`,
        borderLeft: `0.1875rem solid ${accentColor}`,
        background: accentBg,
        padding: '0.5rem 0.75rem',
      }}
    >
      <span
        className="font-serif"
        style={{ color: accentColor, fontSize: '0.875rem', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}
      >
        {label}
      </span>

      {choice.message && <NarrationText text={choice.message} />}
      {choice.result_text && <NarrationText text={choice.result_text} />}

      {choice.effects && choice.effects.length > 0 && (
        <EffectsList effects={choice.effects} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
      )}

      {/* Nested: if success branch itself leads to another coin event */}
      {childEvent && childEvent.event_type === 'COIN_EVENT' && (
        <CoinEventBlock
          coinEvent={childEvent}
          eventById={eventById}
          choicesByEventId={choicesByEventId}
          giftByGameId={giftByGameId}
          onSelectGift={onSelectGift}
          depth={depth + 1}
        />
      )}
      {childEvent && childEvent.event_type === 'ACTION' && (
        <div style={{ marginTop: '0.5rem' }}>
          <ChoiceList
            event={childEvent}
            eventById={eventById}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            onSelectGift={onSelectGift}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  )
}

// ── Single choice row ─────────────────────────────────────────────────────────

interface ProbBranch {
  probability: string | null
  effects: ChoiceEffect[]
}

interface ChoiceItemProps {
  choice: MdEventChoice
  index: number
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth: number
  /** When set, render probability-labeled branches instead of merged effects */
  probBranches?: ProbBranch[]
}

function ChoiceItem({
  choice,
  index,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth,
  probBranches,
}: ChoiceItemProps) {
  if (depth > 5) return null

  const messageDescClean = choice.message_desc
    ? stripSizeTags(replaceEventPlaceholders(choice.message_desc))
    : null
  const conditionText = messageDescClean
    ? formatCondition(messageDescClean, giftByGameId)
    : null
  const descDisplay = messageDescClean ? stripConditionTag(messageDescClean) : null

  const childEvent = choice.next_event_id ? eventById.get(choice.next_event_id) : null
  const isCoinChild = childEvent?.event_type === 'COIN_EVENT'

  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.055)',
        borderLeft: '0.1875rem solid rgba(200,144,10,0.55)',
        borderRadius: '0.5rem',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ padding: '0.875rem 1rem' }}>
        {/* Header row: index + message */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span
            style={{
              flexShrink: 0,
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: '50%',
              background: 'rgba(200,144,10,0.12)',
              border: '1px solid rgba(200,144,10,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c8900a',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              marginTop: '0.125rem',
            }}
          >
            {index + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              className="font-serif"
              style={{ color: '#e8dcc8', fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.5 }}
            >
              {parseUnityColorTags(stripSizeTags(choice.message ?? ''))}
            </p>

            {/* message_desc subtitle (sans condition tag) */}
            {descDisplay && descDisplay.length > 0 && (
              <p style={{ color: '#8a7a60', fontSize: '0.75rem', lineHeight: 1.5, marginTop: '0.25rem' }}>
                {parseUnityColorTags(descDisplay)}
              </p>
            )}

            {/* Condition line */}
            {conditionText && (
              <div
                style={{
                  marginTop: '0.4375rem',
                  padding: '0.25rem 0.625rem',
                  border: '1px solid rgba(200,144,10,0.25)',
                  borderLeft: '0.1875rem solid rgba(200,144,10,0.6)',
                  borderRadius: '0.3125rem',
                  background: 'rgba(200,144,10,0.05)',
                  fontSize: '0.6875rem',
                  color: '#c8a060',
                  display: 'inline-block',
                }}
              >
                {conditionText}
              </div>
            )}
          </div>
        </div>

        {/* Result narration */}
        {choice.result_text && (
          <div style={{ marginTop: '0.625rem', paddingLeft: '2.25rem' }}>
            <NarrationText text={choice.result_text} />
          </div>
        )}

        {/* Effects — probability branches or plain merged effects */}
        {probBranches ? (
          <div style={{ marginTop: '0.375rem', paddingLeft: '2.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {probBranches.map((branch, bi) => {
              const label = formatProb(branch.probability)
              return (
                <div
                  key={bi}
                  style={{
                    border: '1px solid rgba(200,144,10,0.18)',
                    borderRadius: '0.375rem',
                    padding: '0.375rem 0.625rem',
                    background: 'rgba(200,144,10,0.04)',
                  }}
                >
                  {label && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.375rem',
                        background: 'rgba(200,144,10,0.12)',
                        border: '1px solid rgba(200,144,10,0.25)',
                        borderRadius: '0.25rem',
                        color: '#c8900a',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                      }}
                    >
                      {label}
                    </span>
                  )}
                  <EffectsList effects={branch.effects} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
                </div>
              )
            })}
          </div>
        ) : (
          choice.effects && choice.effects.length > 0 && (
            <div style={{ marginTop: '0.25rem', paddingLeft: '2.25rem' }}>
              <EffectsList effects={choice.effects} giftByGameId={giftByGameId} onSelectGift={onSelectGift} />
            </div>
          )
        )}

        {/* Coin event child */}
        {isCoinChild && childEvent && (
          <div style={{ marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
            <CoinEventBlock
              coinEvent={childEvent}
              eventById={eventById}
              choicesByEventId={choicesByEventId}
              giftByGameId={giftByGameId}
              onSelectGift={onSelectGift}
              depth={depth + 1}
            />
          </div>
        )}

        {/* Non-coin child event (nested choices) */}
        {childEvent && childEvent.event_type !== 'COIN_EVENT' && (
          <div
            style={{
              marginTop: '0.75rem',
              paddingLeft: '0.75rem',
              borderLeft: '2px solid rgba(200,144,10,0.12)',
            }}
          >
            <ChoiceList
              event={childEvent}
              eventById={eventById}
              choicesByEventId={choicesByEventId}
              giftByGameId={giftByGameId}
              onSelectGift={onSelectGift}
              depth={depth + 1}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Choice list (recursive entry point) ──────────────────────────────────────

interface ChoiceListProps {
  event: MdEvent
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
  depth?: number
}

function ChoiceList({
  event,
  eventById,
  choicesByEventId,
  giftByGameId,
  onSelectGift,
  depth = 0,
}: ChoiceListProps) {
  if (depth > 5) return null
  const choices = choicesByEventId.get(event.id) ?? []
  if (choices.length === 0) return null

  // Group consecutive choices with the same message (probability branches)
  const grouped: {
    representative: MdEventChoice
    choices: MdEventChoice[]
    mergedEffects: ChoiceEffect[]
  }[] = []
  for (const choice of choices) {
    const last = grouped[grouped.length - 1]
    if (last && last.representative.message === choice.message) {
      last.choices.push(choice)
      const extraEffects = (choice.effects ?? []).filter(e => e.type !== 'nothing')
      last.mergedEffects.push(...extraEffects)
    } else {
      const baseEffects = (choice.effects ?? []).filter(e => e.type !== 'nothing')
      grouped.push({ representative: choice, choices: [choice], mergedEffects: baseEffects })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {grouped.map((group, i) => {
        // Determine if we should show per-branch probability labels:
        // only when there are multiple branches AND all of them have real (non-nothing) effects
        let probBranches: ProbBranch[] | undefined
        if (group.choices.length > 1) {
          const allHaveRealEffects = group.choices.every(
            c => (c.effects ?? []).some(e => e.type !== 'nothing')
          )
          if (allHaveRealEffects) {
            probBranches = group.choices.map(c => ({
              probability: c.probability,
              effects: (c.effects ?? []).filter(e => e.type !== 'nothing'),
            }))
          }
        }
        return (
          <ChoiceItem
            key={group.representative.id}
            choice={probBranches ? { ...group.representative, effects: [] } : { ...group.representative, effects: group.mergedEffects }}
            index={i}
            eventById={eventById}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            onSelectGift={onSelectGift}
            depth={depth}
            probBranches={probBranches}
          />
        )
      })}
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <div
        style={{
          width: '0.1875rem',
          height: '0.875rem',
          background: 'linear-gradient(to bottom, var(--gold), rgba(200,144,10,0.4))',
          borderRadius: '0.125rem',
          flexShrink: 0,
        }}
      />
      <p
        style={{
          color: '#9a8a68',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </p>
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'linear-gradient(90deg, rgba(200,144,10,0.15), transparent 60%)',
        }}
      />
    </div>
  )
}

// ── Main EventModal ───────────────────────────────────────────────────────────

export default function EventModal({
  event,
  eventById,
  choicesByEventId,
  giftByGameId,
  themes,
  onClose,
  onSelectGift,
}: EventModalProps) {
  const evThemes = (event.theme_ids ?? [])
    .map(tid => themes.find(th => th.id === tid))
    .filter((t): t is EgoGiftTheme => Boolean(t))

  const evGifts = (event.gift_ids ?? [])
    .map(gid => giftByGameId.get(gid))
    .filter((g): g is EgoGift => Boolean(g))

  const handleSelectGift = (gift: EgoGift) => {
    onClose()
    onSelectGift(gift)
  }

  const choices = choicesByEventId.get(event.id) ?? []

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="58rem" padding="1rem">
      {/* Responsive styles for sidebar layout */}
      <style>{`
        @media (min-width: 768px) {
          .event-modal-sidebar {
            width: 17rem !important;
            flex-shrink: 0 !important;
            border-bottom: none !important;
            border-right: 1px solid rgba(200,144,10,0.1) !important;
            padding: 1.5rem 1.25rem 1.5rem 1.5rem !important;
            gap: 1.25rem !important;
          }
          .event-modal-image-wrap {
            aspect-ratio: 4 / 3 !important;
          }
          .event-modal-content {
            padding: 1.5rem 1.5rem 1.5rem 1.25rem !important;
          }
        }
      `}</style>
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxHeight: '90vh',
          borderRadius: '0.875rem',
          background: 'linear-gradient(160deg, #161310 0%, #131110 50%, #100e0c 100%)',
          border: '1px solid rgba(200,144,10,0.14)',
          boxShadow:
            '0 0 0 1px rgba(200,144,10,0.04), 0 0 3.5rem rgba(200,144,10,0.08), 0 2rem 5rem rgba(0,0,0,0.7)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 flex items-center justify-center"
          style={{
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)',
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'color 0.2s, background 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#e8d8c0'
            e.currentTarget.style.background = 'rgba(200,144,10,0.18)'
            e.currentTarget.style.borderColor = 'rgba(200,144,10,0.35)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
            e.currentTarget.style.background = 'rgba(0,0,0,0.5)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          <X size={15} />
        </button>

        {/* Scroll container */}
        <div style={{ maxHeight: '90vh', overflowY: 'auto' }}>

          {/* ── Two-column layout (stacks on mobile) ──────── */}
          <div className="flex flex-col md:flex-row" style={{ gap: 0, minHeight: 0 }}>
            {/* ── LEFT SIDEBAR ─────────────────────────────── */}
            <div
              className="event-modal-sidebar"
              style={{
                width: '100%',
                borderBottom: '1px solid rgba(200,144,10,0.1)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                background: 'rgba(0,0,0,0.15)',
              }}
            >
              {/* Event image */}
              {event.image_url ? (
                <div
                  className="event-modal-image-wrap"
                  style={{
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    aspectRatio: '16 / 9',
                    position: 'relative',
                    background: '#0d0b08',
                    border: '1px solid rgba(200,144,10,0.12)',
                  }}
                >
                  <ImageWithFallback
                    src={event.image_url}
                    alt=""
                    fill
                    fallbackType="default"
                    sizes="(max-width: 767px) 100vw, 17rem"
                    className="object-cover"
                    style={{ opacity: 0.85 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(to top, rgba(19,17,16,0.6) 0%, transparent 50%)',
                    }}
                  />
                </div>
              ) : (
                <div
                  className="event-modal-image-wrap"
                  style={{
                    borderRadius: '0.5rem',
                    aspectRatio: '16 / 9',
                    background: 'rgba(200,144,10,0.04)',
                    border: '1px solid rgba(200,144,10,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: 'rgba(200,144,10,0.3)', fontSize: '2rem' }}>✦</span>
                </div>
              )}

              {/* Event name */}
              <h2
                className="font-serif font-bold"
                style={{
                  fontSize: '1.0625rem',
                  color: '#f0e2c0',
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                  margin: 0,
                }}
              >
                {event.name ||
                  (event.desc_text
                    ? event.desc_text.split('\n')[0].slice(0, 40)
                    : `이벤트 #${event.id}`)}
              </h2>

              {/* Description text */}
              {event.desc_text && (
                <div>
                  {replaceEventPlaceholders(event.desc_text)
                    .split('\n\n')
                    .map((para, pi) => (
                      <p
                        key={pi}
                        className="whitespace-pre-line"
                        style={{
                          color: pi === 0 ? '#cebf9e' : '#a08870',
                          fontSize: '0.8125rem',
                          lineHeight: 1.85,
                          marginBottom: pi < replaceEventPlaceholders(event.desc_text!).split('\n\n').length - 1 ? '0.625rem' : 0,
                          ...(pi === 0 ? { fontWeight: 500 } : {}),
                        }}
                      >
                        {colorizeEventText(para)}
                      </p>
                    ))}
                </div>
              )}

              {/* Related E.G.O Gifts */}
              {evGifts.length > 0 && (
                <div>
                  <SectionLabel>획득 가능 기프트</SectionLabel>
                  {/* position: relative + zIndex: 0 isolates GiftCard hover z-index */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 0,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    {evGifts.map(g => (
                      <GiftCard
                        key={g.id}
                        gift={g}
                        onClick={() => handleSelectGift(g)}
                        size="2.5rem"
                        showName={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Related Theme Packs */}
              {evThemes.length > 0 && evThemes.length <= 8 && (
                <div>
                  <SectionLabel>출현 테마팩</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {evThemes.map(t => {
                      const dColor =
                        t.difficulty === 'extreme'
                          ? '#c04040'
                          : t.difficulty === 'hard'
                            ? '#d08030'
                            : '#706050'
                      return (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.3125rem 0.5rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '0.375rem',
                          }}
                        >
                          {t.image_url && (
                            <ImageWithFallback
                              src={t.image_url}
                              alt=""
                              width={8}
                              height={14}
                              fallbackType="theme"
                              style={{
                                width: '0.5rem',
                                height: '0.875rem',
                                objectFit: 'cover',
                                borderRadius: '1px',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span style={{ color: '#b0a088', fontSize: '0.6875rem', flex: 1, minWidth: 0 }}>
                            {t.name}
                          </span>
                          <span
                            style={{
                              color: dColor,
                              fontSize: '0.5rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {t.difficulty === 'extreme'
                              ? 'EX'
                              : t.difficulty === 'hard'
                                ? 'HARD'
                                : 'NML'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT CONTENT: Choices ──────────────────── */}
            <div
              className="event-modal-content"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '1rem',
              }}
            >
              {choices.length > 0 ? (
                <>
                  <SectionLabel>선택지</SectionLabel>
                  <ChoiceList
                    event={event}
                    eventById={eventById}
                    choicesByEventId={choicesByEventId}
                    giftByGameId={giftByGameId}
                    onSelectGift={handleSelectGift}
                    depth={0}
                  />
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '8rem',
                    color: 'rgba(200,144,10,0.3)',
                    fontSize: '0.8125rem',
                  }}
                >
                  선택지 정보 없음
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}
