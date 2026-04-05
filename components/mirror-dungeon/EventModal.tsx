'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type {
  MirrorDungeonEvent,
  EgoGift,
  EgoGiftTheme,
  EventOption,
  EventRewardBranch,
  EventRewardEffect,
} from '@/components/mirror-dungeon/types'
import { KEYWORD_COLORS } from '@/components/mirror-dungeon/types'
import {
  colorizeEventText,
  replaceEventPlaceholders,
  getOptionEffects,
  getAbEventEffects,
} from '@/lib/utils/event-text'
import { STORAGE_BASE } from '@/lib/constants/game'

// ── Types ───────────────────────────────────────────────────────────────────

interface EventModalProps {
  event: MirrorDungeonEvent
  allEvents: MirrorDungeonEvent[]
  giftByGameId: Map<number, EgoGift>
  themes: EgoGiftTheme[]
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Get accent color for option based on content */
function getOptionAccent(messageDesc: string | undefined): string {
  const desc = (messageDesc || '').toLowerCase()
  if (desc.includes('전투')) return '#c04040'
  if (desc.includes('심판') || desc.includes('판정')) return 'rgba(200,144,10,0.7)'
  return 'rgba(200,144,10,0.5)'
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        style={{
          width: '0.1875rem',
          height: '0.875rem',
          background: 'var(--gold)',
          borderRadius: '0.125rem',
        }}
      />
      <p
        style={{
          color: '#8a7a60',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </p>
    </div>
  )
}

function EffectPill({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '0.375rem 0.625rem',
        background: 'rgba(200,144,10,0.04)',
        border: '1px solid rgba(200,144,10,0.1)',
        borderLeft: '0.1875rem solid rgba(200,144,10,0.35)',
        borderRadius: '0.25rem',
        fontSize: '0.75rem',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

// ── Reward badge helpers ─────────────────────────────────────────────────────

interface EffectSpec {
  label: string
  color: string
  bg: string
  border: string
}

function getEffectSpec(effect: EventRewardEffect): EffectSpec {
  const a = effect.amount
  const c = effect.count
  switch (effect.type) {
    case 'cost':
      return {
        label: `+${a ?? '?'} 코스트`,
        color: '#c8900a',
        bg: 'rgba(200,144,10,0.12)',
        border: 'rgba(200,144,10,0.3)',
      }
    case 'cost_loss':
      return {
        label: `-${a ?? '?'} 코스트`,
        color: '#e04040',
        bg: 'rgba(224,64,64,0.1)',
        border: 'rgba(224,64,64,0.3)',
      }
    case 'gift':
      return {
        label: `기프트 x${c ?? 1}`,
        color: '#b090d0',
        bg: 'rgba(176,144,208,0.1)',
        border: 'rgba(176,144,208,0.3)',
      }
    case 'gift_battle':
      return {
        label: '전투 승리 시 기프트',
        color: '#b090d0',
        bg: 'rgba(176,144,208,0.08)',
        border: 'rgba(176,144,208,0.4)',
      }
    case 'battle':
    case 'battle_abnormality':
      return {
        label: '환상체 전투',
        color: '#e04040',
        bg: 'rgba(224,64,64,0.1)',
        border: 'rgba(224,64,64,0.35)',
      }
    case 'hp_loss':
      return {
        label: `체력 -${a ?? '?'}%`,
        color: '#e04040',
        bg: 'rgba(224,64,64,0.1)',
        border: 'rgba(224,64,64,0.3)',
      }
    case 'hp_recover':
    case 'hp_recover_ratio':
      return {
        label: `체력 +${a ?? '?'}%`,
        color: '#40a060',
        bg: 'rgba(64,160,96,0.1)',
        border: 'rgba(64,160,96,0.3)',
      }
    case 'mp_loss':
      return {
        label: `정신력 -${a ?? '?'}`,
        color: '#c04070',
        bg: 'rgba(192,64,112,0.1)',
        border: 'rgba(192,64,112,0.3)',
      }
    case 'mp_recover':
      return {
        label: `정신력 +${a ?? '?'}`,
        color: '#4080c0',
        bg: 'rgba(64,128,192,0.1)',
        border: 'rgba(64,128,192,0.3)',
      }
    case 'hp_mp_recover':
      return {
        label: `체력/정신력 +${a ?? '?'}%`,
        color: '#40a060',
        bg: 'rgba(64,160,96,0.1)',
        border: 'rgba(64,160,96,0.3)',
      }
    case 'hp_mp_loss':
      return {
        label: `체력/정신력 -${a ?? '?'}%`,
        color: '#e04040',
        bg: 'rgba(224,64,64,0.1)',
        border: 'rgba(224,64,64,0.3)',
      }
    case 'nothing':
      return {
        label: '없음',
        color: '#888',
        bg: 'rgba(136,136,136,0.1)',
        border: 'rgba(136,136,136,0.25)',
      }
    case 'level_up':
      return {
        label: '레벨 업',
        color: '#c8900a',
        bg: 'rgba(200,144,10,0.12)',
        border: 'rgba(200,144,10,0.3)',
      }
    case 'get_character':
      return {
        label: '수감자 영입',
        color: '#c8900a',
        bg: 'rgba(200,144,10,0.12)',
        border: 'rgba(200,144,10,0.3)',
      }
    default:
      return {
        label: effect.type,
        color: '#888',
        bg: 'rgba(136,136,136,0.1)',
        border: 'rgba(136,136,136,0.25)',
      }
  }
}

function EffectBadge({ effect }: { effect: EventRewardEffect }) {
  const spec = getEffectSpec(effect)
  const showCostIcon = effect.type === 'cost' || effect.type === 'cost_loss'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.1875rem 0.5rem',
        borderRadius: '0.25rem',
        background: spec.bg,
        border: `1px solid ${spec.border}`,
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: spec.color,
        whiteSpace: 'nowrap',
      }}
    >
      {showCostIcon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${STORAGE_BASE}/icons/ui/credits.webp`}
          alt=""
          style={{ width: '0.75rem', height: '0.75rem' }}
        />
      )}
      {spec.label}
    </span>
  )
}

// kept for child-event blocks that still use the flat probability+effects layout
function RewardBadges({ rewards }: { rewards: EventRewardBranch[] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3125rem',
        marginTop: '0.5rem',
      }}
    >
      {rewards.map((branch, bi) => {
        const prob = branch.probability
        const isFullProb = prob === 1 || prob === '1' || prob === 1.0
        const probNum = typeof prob === 'number' ? prob : null

        return (
          <div
            key={bi}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {/* Probability badge — only when not 100% */}
            {!isFullProb && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: probNum !== null ? '#e8b030' : '#888',
                  background: probNum !== null ? 'rgba(232,176,48,0.1)' : 'rgba(136,136,136,0.1)',
                  border: `1px solid ${probNum !== null ? 'rgba(232,176,48,0.3)' : 'rgba(136,136,136,0.25)'}`,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.6,
                }}
              >
                {probNum !== null ? `${Math.round(probNum * 100)}%` : String(prob)}
              </span>
            )}

            {/* Effect badges */}
            {branch.effects.map((eff, ei) => (
              <EffectBadge key={ei} effect={eff} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function GiftBadge({
  gift,
  onSelect,
}: {
  gift: EgoGift
  onSelect: (g: EgoGift) => void
}) {
  const kw = KEYWORD_COLORS[gift.keyword] ?? '#666'
  return (
    <button
      onClick={() => onSelect(gift)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10"
      style={{
        cursor: 'pointer',
        background: `${kw}12`,
        border: `1px solid ${kw}20`,
        fontSize: '0.6875rem',
      }}
    >
      {gift.image_url && (
        <ImageWithFallback
          src={gift.image_url}
          alt=""
          width={14}
          height={14}
          fallbackType="gift"
          style={{ width: '0.875rem', height: '0.875rem' }}
        />
      )}
      <span style={{ color: '#ccc' }}>{gift.name}</span>
    </button>
  )
}

// ── Child Event Block ───────────────────────────────────────────────────────

function ChildEventBlock({
  child,
  giftByGameId,
  onSelectGift,
}: {
  child: MirrorDungeonEvent
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
}) {
  const abEffects = getAbEventEffects(child.id)
  const successOpts = (child.options || []).filter(co => co.message?.startsWith('성공'))
  const failureOpts = (child.options || []).filter(co => co.message?.startsWith('실패'))
  const otherOpts = (child.options || []).filter(
    co => !co.message?.startsWith('성공') && !co.message?.startsWith('실패'),
  )

  return (
    <details
      className="overflow-hidden mt-2.5"
      style={{
        borderRadius: '0.5rem',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(200,144,10,0.1)',
      }}
    >
      <summary
        className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer list-none transition-colors"
        style={{
          color: '#c8a868',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(200,144,10,0.04)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <span style={{ fontSize: '0.5rem', opacity: 0.5, transition: 'transform 0.2s' }}>
          &#9654;
        </span>
        <span className="flex-1">
          {child.name ||
            replaceEventPlaceholders(child.desc_text?.split('\n')[0]?.slice(0, 40)) ||
            '연계 이벤트'}
        </span>
        {(successOpts.length > 0 || failureOpts.length > 0) && (
          <span
            style={{
              fontSize: '0.5625rem',
              color: '#888',
              fontFamily: 'var(--font-mono)',
            }}
          >
            판정
          </span>
        )}
      </summary>

      <div
        className="px-3.5 pb-3.5 pt-2"
        style={{ borderTop: '1px solid rgba(200,144,10,0.06)' }}
      >
        {/* Judgment condition (behaveDesc) */}
        {child.desc_text && (
          <p
            className="whitespace-pre-line mb-3"
            style={{ color: '#9a8a7a', fontSize: '0.75rem', lineHeight: 1.7 }}
          >
            {colorizeEventText(child.desc_text)}
          </p>
        )}

        {/* Success block */}
        {successOpts.map((co, ci) => (
          <div
            key={`s${ci}`}
            className="mb-2.5"
            style={{ paddingLeft: '0.75rem', borderLeft: '2px solid rgba(0,210,138,0.4)' }}
          >
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#00d48a', marginBottom: '0.375rem' }}>
              성공
            </p>
            {co.result && co.result[0] && (
              <p
                className="whitespace-pre-line"
                style={{ color: '#9a8a7a', fontSize: '0.75rem', lineHeight: 1.7 }}
              >
                {colorizeEventText(co.result[0])}
              </p>
            )}
            {/* Success effects from game data */}
            {abEffects.success.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.375rem' }}>
                {abEffects.success.map((eff: React.ReactNode, ei: number) => (
                  <EffectPill key={ei}>{eff}</EffectPill>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Failure block */}
        {failureOpts.map((co, ci) => (
          <div
            key={`f${ci}`}
            className="mb-2.5"
            style={{ paddingLeft: '0.75rem', borderLeft: '2px solid rgba(227,0,0,0.4)' }}
          >
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e30000', marginBottom: '0.375rem' }}>
              실패
            </p>
            {co.result && co.result[0] && (
              <p
                className="whitespace-pre-line"
                style={{ color: '#9a8a7a', fontSize: '0.75rem', lineHeight: 1.7 }}
              >
                {colorizeEventText(co.result[0])}
              </p>
            )}
            {/* Failure effects from game data */}
            {abEffects.failure.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.375rem' }}>
                {abEffects.failure.map((eff: React.ReactNode, ei: number) => (
                  <EffectPill key={ei}>{eff}</EffectPill>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Other options (not success/failure) */}
        {otherOpts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {otherOpts.map((co, ci) => (
              <div
                key={ci}
                style={{ paddingLeft: '0.5rem', borderLeft: '2px solid rgba(200,144,10,0.15)' }}
              >
                <p style={{ color: '#bbb', fontSize: '0.75rem', lineHeight: 1.5 }}>
                  {colorizeEventText(co.message)}
                </p>
                {co.messageDesc && (
                  <span
                    className="inline-block mt-0.5 px-1.5 py-0.5"
                    style={{
                      color: '#a08860',
                      fontSize: '0.625rem',
                      fontFamily: 'var(--font-heading)',
                      background: 'rgba(200,144,10,0.06)',
                      borderRadius: '0.1875rem',
                      border: '1px solid rgba(200,144,10,0.1)',
                    }}
                  >
                    {colorizeEventText(co.messageDesc)}
                  </span>
                )}
                {co.result && co.result[0] && (
                  <p
                    className="mt-1 whitespace-pre-line"
                    style={{ color: '#706050', fontSize: '0.6875rem', lineHeight: 1.5 }}
                  >
                    {colorizeEventText(co.result[0])}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Child event effects (when no success/failure split) */}
        {successOpts.length === 0 && failureOpts.length === 0 && (abEffects.success.length > 0 || abEffects.failure.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
            {[...abEffects.success, ...abEffects.failure].map((eff: React.ReactNode, ei: number) => (
              <EffectPill key={ei}>{eff}</EffectPill>
            ))}
          </div>
        )}

        {/* Child gifts */}
        {child.gift_ids && child.gift_ids.length > 0 && (
          <div
            className="flex flex-wrap gap-1 mt-2.5 pt-2"
            style={{ borderTop: '1px solid rgba(200,144,10,0.08)' }}
          >
            {child.gift_ids.map(gid => {
              const g = giftByGameId.get(gid)
              if (!g) return null
              return <GiftBadge key={gid} gift={g} onSelect={onSelectGift} />
            })}
          </div>
        )}
      </div>
    </details>
  )
}

// ── Option Card ─────────────────────────────────────────────────────────────

function OptionCard({
  event,
  opt,
  index,
  children: optChildren,
  giftByGameId,
  onSelectGift,
}: {
  event: MirrorDungeonEvent
  opt: EventOption
  index: number
  children: MirrorDungeonEvent[]
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
}) {
  const accentColor = getOptionAccent(opt.messageDesc)

  // 게임 데이터에서 직접 조회 — 추론 없음
  const allEffects = getOptionEffects(event.id, index)

  // Option gifts
  const optionGiftIds = event.option_gifts?.[index] ?? []

  return (
    <div
      className="overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '0.5rem',
        borderLeft: `0.1875rem solid ${accentColor}`,
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Option number badge */}
        <span
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '50%',
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}30`,
            color: accentColor,
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            marginTop: '0.125rem',
          }}
        >
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {/* Choice text */}
          <p style={{ color: '#e8dcc8', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {colorizeEventText(opt.message)}
          </p>

          {/* Hint text (messageDesc) */}
          {opt.messageDesc && (
            <span
              className="inline-block mt-1.5 px-2 py-0.5"
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                color: accentColor,
                background: `${accentColor}10`,
                border: `1px solid ${accentColor}20`,
                borderRadius: '0.25rem',
                lineHeight: 1.4,
              }}
            >
              {colorizeEventText(opt.messageDesc)}
            </span>
          )}

          {/* Results paired with reward branches */}
          {opt.rewards && opt.rewards.length > 0 ? (
            opt.rewards.map((branch, bi) => {
              const resultText = opt.result?.[bi]
              const prob = branch.probability
              const isFullProb = prob === 1 || prob === '1' || prob === 1.0
              const probNum = typeof prob === 'number' ? prob : null

              return (
                <div
                  key={bi}
                  style={{
                    marginTop: bi === 0 ? '0.5rem' : '0.75rem',
                    paddingTop: bi > 0 ? '0.75rem' : 0,
                    borderTop: bi > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  {/* Probability header — only when not 100% */}
                  {!isFullProb && (
                    <div
                      style={{
                        color: '#e8b030',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        marginBottom: '0.375rem',
                      }}
                    >
                      {probNum !== null ? `${Math.round(probNum * 100)}%` : String(prob)}
                    </div>
                  )}

                  {/* Result narrative text */}
                  {resultText && (
                    <div
                      style={{
                        paddingLeft: '0.75rem',
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                        marginBottom: '0.375rem',
                      }}
                    >
                      <p
                        className="whitespace-pre-line"
                        style={{ color: '#807060', fontSize: '0.75rem', lineHeight: 1.7 }}
                      >
                        {colorizeEventText(resultText)}
                      </p>
                    </div>
                  )}

                  {/* Effect badges for this branch */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}
                  >
                    {branch.effects.map((eff, ei) => (
                      <EffectBadge key={ei} effect={eff} />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            /* Fallback: no rewards data, show result[0] only */
            opt.result && opt.result[0] ? (
              <div
                className="mt-2"
                style={{ paddingLeft: '0.75rem', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p
                  className="whitespace-pre-line"
                  style={{ color: '#807060', fontSize: '0.75rem', lineHeight: 1.7 }}
                >
                  {colorizeEventText(opt.result[0])}
                </p>
              </div>
            ) : null
          )}

          {/* Game effects */}
          {allEffects.length > 0 && (
            <div
              className="mt-2.5"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
            >
              {allEffects.map((eff, ei) => (
                <EffectPill key={ei}>{eff}</EffectPill>
              ))}
            </div>
          )}

          {/* Option reward gifts */}
          {optionGiftIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {optionGiftIds.map(gid => {
                const g = giftByGameId.get(gid)
                if (!g) return null
                return <GiftBadge key={gid} gift={g} onSelect={onSelectGift} />
              })}
            </div>
          )}

          {/* Linked child events for this option */}
          {optChildren.map(child => (
            <ChildEventBlock
              key={child.id}
              child={child}
              giftByGameId={giftByGameId}
              onSelectGift={onSelectGift}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main EventModal ─────────────────────────────────────────────────────────

export default function EventModal({
  event,
  allEvents,
  giftByGameId,
  themes,
  onClose,
  onSelectGift,
}: EventModalProps) {
  const evThemeNames = (event.theme_ids || [])
    .map(tid => themes.find(th => th.id === tid))
    .filter(Boolean) as EgoGiftTheme[]
  const children = allEvents.filter(c => c.parent_id === event.id)

  // Handle gift selection: close modal then select gift
  const handleSelectGift = (gift: EgoGift) => {
    onClose()
    onSelectGift(gift)
  }

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="36rem" padding="1rem">
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxHeight: '85vh',
          borderRadius: '0.75rem',
          background: '#131110',
          border: '1px solid rgba(200,144,10,0.12)',
          boxShadow: '0 0 3rem rgba(200,144,10,0.06), 0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 flex items-center justify-center transition-all duration-200"
          style={{
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)',
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#e8d8c0'
            e.currentTarget.style.background = 'rgba(200,144,10,0.15)'
            e.currentTarget.style.borderColor = 'rgba(200,144,10,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
            e.currentTarget.style.background = 'rgba(0,0,0,0.4)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          <X size={16} />
        </button>

        {/* Scroll container */}
        <div style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          {/* ── Header banner ── */}
          {event.image_url ? (
            <div className="relative overflow-hidden" style={{ height: '13rem' }}>
              <ImageWithFallback
                src={event.image_url}
                alt=""
                fill
                fallbackType="default"
                sizes="36rem"
                className="object-cover"
                style={{ opacity: 0.45 }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.5) 50%, rgba(19,17,16,0.25) 100%)',
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
                {evThemeNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {evThemeNames.slice(0, 3).map(t => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5"
                        style={{
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(200,144,10,0.8)',
                          background: 'rgba(200,144,10,0.08)',
                          border: '1px solid rgba(200,144,10,0.15)',
                          borderRadius: '0.25rem',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <h2
                  className="font-serif font-bold"
                  style={{
                    fontSize: '1.375rem',
                    color: '#e8d0a0',
                    textShadow:
                      '0 0.125rem 1rem rgba(200,144,10,0.2), 0 0.0625rem 0.25rem rgba(0,0,0,0.8)',
                    lineHeight: 1.3,
                  }}
                >
                  {event.name ||
                    (event.desc_text
                      ? event.desc_text.split('\n')[0].slice(0, 50)
                      : `이벤트 #${event.id}`)}
                </h2>
              </div>
            </div>
          ) : (
            <div
              className="relative overflow-hidden px-6 pt-6 pb-5"
              style={{
                background: 'linear-gradient(135deg, rgba(200,144,10,0.04) 0%, transparent 60%)',
              }}
            >
              <div
                className="absolute top-0 left-0 w-full"
                style={{
                  height: '0.125rem',
                  background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent 70%)',
                }}
              />
              {evThemeNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {evThemeNames.slice(0, 3).map(t => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5"
                      style={{
                        fontSize: '0.625rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'rgba(200,144,10,0.8)',
                        background: 'rgba(200,144,10,0.08)',
                        border: '1px solid rgba(200,144,10,0.15)',
                        borderRadius: '0.25rem',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
              <h2
                className="font-serif font-bold"
                style={{ fontSize: '1.25rem', color: '#e8d0a0', lineHeight: 1.3 }}
              >
                {event.name ||
                  (event.desc_text
                    ? event.desc_text.split('\n')[0].slice(0, 50)
                    : `이벤트 #${event.id}`)}
              </h2>
            </div>
          )}

          {/* ── Content ── */}
          <div className="px-6 pb-6 pt-4 relative">
            {/* Description text (colorized) */}
            {event.desc_text &&
              (() => {
                const paragraphs = replaceEventPlaceholders(event.desc_text).split('\n\n')
                return (
                  <div className="mb-5">
                    {paragraphs.map((para, pi) => (
                      <p
                        key={pi}
                        className="whitespace-pre-line"
                        style={{
                          color: pi === 0 ? '#c8b898' : '#a89878',
                          fontSize: '0.875rem',
                          lineHeight: 1.8,
                          marginBottom: pi < paragraphs.length - 1 ? '0.75rem' : 0,
                          ...(pi === 0 ? { fontWeight: 500 } : {}),
                        }}
                      >
                        {colorizeEventText(para)}
                      </p>
                    ))}
                  </div>
                )
              })()}

            {/* ── Options ── */}
            {event.options && event.options.length > 0 && (
              <div className="mb-5">
                <SectionLabel>선택지</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {event.options.map((opt, i) => {
                    const optChildren = children.filter(c => c.option_index === i)
                    return (
                      <OptionCard
                        key={i}
                        event={event}
                        opt={opt}
                        index={i}
                        giftByGameId={giftByGameId}
                        onSelectGift={handleSelectGift}
                      >
                        {optChildren}
                      </OptionCard>
                    )
                  })}
                </div>

                {/* Unmapped child events (option_index is null) */}
                {children.filter(c => c.option_index == null).length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        style={{
                          width: '0.1875rem',
                          height: '0.75rem',
                          background: 'rgba(200,144,10,0.4)',
                          borderRadius: '0.125rem',
                        }}
                      />
                      <p
                        style={{
                          color: '#a08860',
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-heading)',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                        }}
                      >
                        연계 이벤트
                      </p>
                    </div>
                    {children
                      .filter(c => c.option_index == null)
                      .map(child => (
                        <div key={child.id} className="mb-2">
                          <ChildEventBlock
                            child={child}
                            giftByGameId={giftByGameId}
                            onSelectGift={handleSelectGift}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Theme packs ── */}
            {event.theme_ids && event.theme_ids.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <div
                    style={{
                      width: '0.1875rem',
                      height: '0.75rem',
                      background: 'rgba(200,144,10,0.3)',
                      borderRadius: '0.125rem',
                    }}
                  />
                  <p
                    style={{
                      color: '#8a7a60',
                      fontSize: '0.625rem',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                    }}
                  >
                    출현 테마팩
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {event.theme_ids.slice(0, 20).map(tid => {
                    const t = themes.find(th => th.id === tid)
                    if (!t) return null
                    const dColor =
                      t.difficulty === 'extreme'
                        ? '#c04040'
                        : t.difficulty === 'hard'
                          ? '#d08030'
                          : '#706050'
                    return (
                      <span
                        key={tid}
                        className="inline-flex items-center gap-1.5 px-2 py-1"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '0.375rem',
                          fontSize: '0.6875rem',
                        }}
                      >
                        {t.image_url && (
                          <ImageWithFallback
                            src={t.image_url}
                            alt=""
                            width={10}
                            height={18}
                            fallbackType="theme"
                            style={{
                              width: '0.625rem',
                              height: '1.125rem',
                              objectFit: 'cover',
                              borderRadius: '1px',
                            }}
                          />
                        )}
                        <span style={{ color: '#b0a088' }}>{t.name}</span>
                        <span
                          style={{
                            color: dColor,
                            fontSize: '0.5rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                          }}
                        >
                          {t.difficulty === 'extreme' ? 'EX' : t.difficulty === 'hard' ? 'H' : ''}
                        </span>
                      </span>
                    )
                  })}
                  {event.theme_ids.length > 20 && (
                    <span style={{ color: '#555', fontSize: '0.6875rem', alignSelf: 'center' }}>
                      +{event.theme_ids.length - 20}개
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Acquirable gifts (when option_gifts not used) ── */}
            {!event.option_gifts &&
              (() => {
                const allGiftIds = new Set(event.gift_ids || [])
                allEvents
                  .filter(c => c.parent_id === event.id)
                  .forEach(c => (c.gift_ids || []).forEach(g => allGiftIds.add(g)))
                const evGifts = [...allGiftIds]
                  .map(gid => giftByGameId.get(gid))
                  .filter(Boolean) as EgoGift[]
                if (evGifts.length === 0) return null
                return (
                  <div style={{ borderTop: '1px solid rgba(200,144,10,0.08)', paddingTop: '1rem' }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div
                        style={{
                          width: '0.1875rem',
                          height: '0.75rem',
                          background: 'rgba(200,144,10,0.3)',
                          borderRadius: '0.125rem',
                        }}
                      />
                      <p
                        style={{
                          color: '#8a7a60',
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-heading)',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        획득 가능 기프트
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {evGifts.map(g => (
                        <button
                          key={g.id}
                          onClick={() => handleSelectGift(g)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors hover:bg-white/10"
                          style={{
                            cursor: 'pointer',
                            background: `${KEYWORD_COLORS[g.keyword] ?? '#666'}10`,
                            border: `1px solid ${KEYWORD_COLORS[g.keyword] ?? '#666'}20`,
                          }}
                        >
                          {g.image_url && (
                            <ImageWithFallback
                              src={g.image_url}
                              alt=""
                              width={18}
                              height={18}
                              fallbackType="gift"
                              style={{ width: '1.125rem', height: '1.125rem' }}
                            />
                          )}
                          <span style={{ color: '#ccc', fontSize: '0.75rem' }}>{g.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
          </div>
        </div>
        {/* End scroll container */}
      </div>
    </BaseModal>
  )
}
