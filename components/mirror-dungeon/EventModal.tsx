'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import GiftCard from '@/components/ui/GiftCard'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type {
  MirrorDungeonEvent,
  EgoGift,
  EgoGiftTheme,
  EventOption,
  EventRewardEffect,
} from '@/components/mirror-dungeon/types'
import { KEYWORD_COLORS } from '@/components/mirror-dungeon/types'
import {
  colorizeEventText,
  replaceEventPlaceholders,
  getOptionEffects,
} from '@/lib/utils/event-text'
import { STORAGE_BASE } from '@/lib/constants/game'

// ── Types ────────────────────────────────────────────────────────────────────

interface EventModalProps {
  event: MirrorDungeonEvent
  giftByGameId: Map<number, EgoGift>
  themes: EgoGiftTheme[]
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOptionAccent(messageDesc: string | undefined): string {
  const desc = (messageDesc || '').toLowerCase()
  if (desc.includes('전투')) return '#c04040'
  if (desc.includes('심판') || desc.includes('판정')) return 'rgba(200,144,10,0.8)'
  return 'rgba(200,144,10,0.6)'
}

function formatProbability(prob: number | string): string {
  if (typeof prob === 'number') return `${Math.round(prob * 100)}%`

  const exactMap: Record<string, string> = {
    MpAverage_NotLessThan0: '평균 정신력 0 이상',
    MpAverage_Under0: '평균 정신력 0 미만',
    MpAverage_NotLessThan25: '평균 정신력 25 이상',
    MpAverage_Under25: '평균 정신력 25 미만',
  }
  if (exactMap[prob]) return exactMap[prob]

  const mpMatch = prob.match(/^MpAverage_(Under|NotLessThan)(\d+)$/)
  if (mpMatch) {
    const qualifier = mpMatch[1] === 'Under' ? '미만' : '이상'
    return `평균 정신력 ${mpMatch[2]} ${qualifier}`
  }

  const probMatch = prob.match(/^Prob_(\d+)$/)
  if (probMatch) return `${probMatch[1]}%`

  const repeatMatch = prob.match(/^ProbTimesRepeatCount_(\d+)$/)
  if (repeatMatch) return `${repeatMatch[1]}% × 반복 횟수`

  return prob
}

// ── Recursive child-event renderer ───────────────────────────────────────────

function renderNextEventBranches(
  nextEvent: EventOption['next_event'],
  giftByGameId: Map<number, EgoGift>,
  onSelectGift: (g: EgoGift) => void,
  depth: number = 0
): ReactNode {
  if (!nextEvent?.options || nextEvent.options.length === 0 || depth > 3) return null
  return (
    <div className="mt-3">
      {nextEvent.options.map((childOpt, ci) => {
        const isSuccess = childOpt.message === '성공'
        const isFail = childOpt.message === '실패'
        const branchColor = isSuccess
          ? 'rgba(0,180,100,0.7)'
          : isFail
            ? 'rgba(200,60,60,0.6)'
            : 'rgba(200,144,10,0.5)'

        return (
          <div
            key={ci}
            style={{
              marginTop: ci > 0 ? '0.625rem' : 0,
              paddingTop: ci > 0 ? '0.625rem' : 0,
              borderTop: ci > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            {/* Branch label (성공/실패) */}
            <span
              className="font-serif"
              style={{
                display: 'inline-block',
                color: branchColor,
                fontSize: '0.9375rem',
                fontWeight: 800,
                marginBottom: '0.375rem',
              }}
            >
              {childOpt.message}
            </span>

            {/* Result narrative */}
            {childOpt.result && childOpt.result[0] && (
              <div style={{ marginTop: '0.25rem' }}>
                <p
                  className="whitespace-pre-line"
                  style={{ color: '#807060', fontSize: '0.75rem', lineHeight: 1.7 }}
                >
                  {colorizeEventText(childOpt.result[0])}
                </p>
              </div>
            )}

            {/* Reward effects from child branch */}
            {childOpt.rewards && childOpt.rewards.length > 0 && (
              <div
                style={{
                  position: 'relative',
                  zIndex: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '0.375rem',
                }}
              >
                {childOpt.rewards.map((branch, bi) =>
                  branch.effects.map((eff, ei) => (
                    <EffectBadge
                      key={`${bi}-${ei}`}
                      effect={eff}
                      giftByGameId={giftByGameId}
                      onSelectGift={onSelectGift}
                    />
                  ))
                )}
              </div>
            )}

            {/* Recurse into deeper next_event branches */}
            {renderNextEventBranches(childOpt.next_event, giftByGameId, onSelectGift, depth + 1)}
          </div>
        )
      })}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
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

function EffectPill({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '0.375rem 0.75rem',
        background: 'rgba(200,144,10,0.03)',
        border: '1px solid rgba(200,144,10,0.09)',
        borderLeft: '0.1875rem solid rgba(200,144,10,0.3)',
        borderRadius: '0.25rem',
        fontSize: '0.75rem',
        lineHeight: 1.55,
        backdropFilter: 'blur(4px)',
      }}
    >
      {children}
    </div>
  )
}

function EffectBadge({
  effect,
  giftByGameId,
  onSelectGift,
}: {
  effect: EventRewardEffect
  giftByGameId: Map<number, EgoGift>
  onSelectGift?: (gift: EgoGift) => void
}) {
  if (effect.type === 'cost' || effect.type === 'cost_loss') {
    const isCost = effect.type === 'cost'
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.21875rem 0.5625rem',
          borderRadius: '0.3125rem',
          background: isCost ? 'rgba(200,144,10,0.1)' : 'rgba(224,64,64,0.1)',
          border: `1px solid ${isCost ? 'rgba(200,144,10,0.3)' : 'rgba(224,64,64,0.3)'}`,
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          color: isCost ? '#c8900a' : '#e04040',
          whiteSpace: 'nowrap',
          boxShadow: isCost
            ? '0 0 0.5rem rgba(200,144,10,0.12) inset'
            : '0 0 0.5rem rgba(224,64,64,0.1) inset',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${STORAGE_BASE}/icons/ui/credits.webp`}
          alt=""
          style={{ width: '0.75rem', height: '0.75rem' }}
        />
        {isCost ? '+' : '-'}{effect.amount}
      </span>
    )
  }

  if (effect.type === 'gift' || effect.type === 'gift_battle') {
    const gift = effect.gift_id ? giftByGameId.get(effect.gift_id) : null
    if (!gift) return null
    return (
      <GiftCard
        gift={gift}
        onClick={() => onSelectGift?.(gift)}
        size="3.5rem"
        showName={true}
      />
    )
  }

  if (effect.type === 'battle' || effect.type === 'battle_abnormality') return null

  return null
}

// ── OptionCard ────────────────────────────────────────────────────────────────

function OptionCard({
  event,
  opt,
  index,
  giftByGameId,
  onSelectGift,
}: {
  event: MirrorDungeonEvent
  opt: EventOption
  index: number
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (g: EgoGift) => void
}) {
  const accentColor = getOptionAccent(opt.messageDesc)
  const allEffects = getOptionEffects(event.id, index)

  return (
    <div
      className="overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.055)',
        borderLeft: `0.1875rem solid ${accentColor}`,
        borderRadius: '0.5rem',
        backdropFilter: 'blur(6px)',
        boxShadow: `inset 0 0 1.5rem rgba(0,0,0,0.15), 0 0 0.75rem ${accentColor}0a`,
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Option number badge */}
        <span
          className="flex-shrink-0 flex items-center justify-center"
          style={{
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '50%',
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}38`,
            color: accentColor,
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            marginTop: '0.125rem',
            flexShrink: 0,
            boxShadow: `0 0 0.625rem ${accentColor}20`,
          }}
        >
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {/* Choice text */}
          <p style={{ color: '#e8dcc8', fontSize: '0.875rem', lineHeight: 1.65 }}>
            {colorizeEventText(opt.message)}
          </p>

          {/* Hint tag (messageDesc) — strip Unity size/color tags */}
          {opt.messageDesc && (
            <span
              className="inline-block mt-1.5 px-2 py-0.5"
              style={{
                fontSize: '0.6875rem',
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '0.25rem',
                lineHeight: 1.4,
              }}
            >
              {opt.messageDesc
                .replace(/<size=[^>]*>/g, '')
                .replace(/<\/size>/g, '')
                .replace(/<color=[^>]*>/g, '')
                .replace(/<\/color[^>]*>/g, '')}
            </span>
          )}

          {/* Reward branches */}
          {opt.rewards && opt.rewards.length > 0 ? (
            opt.rewards.map((branch, bi) => {
              const resultText = opt.result?.[bi]
              const prob = branch.probability
              const isFullProb = prob === 1 || prob === '1' || prob === 1.0

              return (
                <div
                  key={bi}
                  style={{
                    marginTop: bi === 0 ? '0.625rem' : '0.875rem',
                    paddingTop: bi > 0 ? '0.875rem' : 0,
                    borderTop: bi > 0 ? '1px solid rgba(255,255,255,0.055)' : 'none',
                  }}
                >
                  {/* Probability pill */}
                  {!isFullProb && (
                    <div className="mb-1.5">
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3125rem',
                          padding: '0.1875rem 0.5625rem',
                          background: 'rgba(232,176,48,0.09)',
                          border: '1px solid rgba(232,176,48,0.22)',
                          borderRadius: '0.3125rem',
                          color: '#e8b030',
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                          boxShadow: '0 0 0.5rem rgba(232,176,48,0.1) inset',
                        }}
                      >
                        <span style={{ opacity: 0.6, fontSize: '0.5625rem' }}>◆</span>
                        {formatProbability(prob)}
                      </span>
                    </div>
                  )}

                  {/* Result narrative */}
                  {resultText && (
                    <div
                      style={{
                        paddingLeft: '0.875rem',
                        borderLeft: '2px solid rgba(255,255,255,0.07)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <p
                        className="whitespace-pre-line"
                        style={{ color: '#7a6e5e', fontSize: '0.75rem', lineHeight: 1.75 }}
                      >
                        {colorizeEventText(resultText)}
                      </p>
                    </div>
                  )}

                  {/* Effect badges — position: relative + zIndex: 0 isolates GiftCard hover */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 0,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-end',
                      gap: '0.5rem',
                    }}
                  >
                    {branch.effects.map((eff, ei) => (
                      <EffectBadge
                        key={ei}
                        effect={eff}
                        giftByGameId={giftByGameId}
                        onSelectGift={onSelectGift}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            opt.result && opt.result[0] ? (
              <div
                className="mt-2"
                style={{
                  paddingLeft: '0.875rem',
                  borderLeft: '2px solid rgba(255,255,255,0.07)',
                }}
              >
                <p
                  className="whitespace-pre-line"
                  style={{ color: '#7a6e5e', fontSize: '0.75rem', lineHeight: 1.75 }}
                >
                  {colorizeEventText(opt.result[0])}
                </p>
              </div>
            ) : null
          )}

          {/* ── Child event (next_event) branches — recursive ── */}
          {renderNextEventBranches(opt.next_event, giftByGameId, onSelectGift)}

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
        </div>
      </div>
    </div>
  )
}

// ── Main EventModal ───────────────────────────────────────────────────────────

export default function EventModal({
  event,
  giftByGameId,
  themes,
  onClose,
  onSelectGift,
}: EventModalProps) {
  const evThemeNames = (event.theme_ids || [])
    .map(tid => themes.find(th => th.id === tid))
    .filter(Boolean) as EgoGiftTheme[]

  const handleSelectGift = (gift: EgoGift) => {
    onClose()
    onSelectGift(gift)
  }

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="37rem" padding="1rem">
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxHeight: '88vh',
          borderRadius: '0.875rem',
          background: 'linear-gradient(160deg, #161310 0%, #131110 50%, #100e0c 100%)',
          border: '1px solid rgba(200,144,10,0.14)',
          boxShadow:
            '0 0 0 1px rgba(200,144,10,0.04), 0 0 3.5rem rgba(200,144,10,0.08), 0 2rem 5rem rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Close button ─────────────────────────────────────────── */}
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

        {/* ── Scroll container ───────────────────────────────────── */}
        <div style={{ maxHeight: '88vh', overflowY: 'auto' }}>

          {/* ── Header banner ──────────────────────────────────── */}
          {event.image_url ? (
            <div className="relative overflow-hidden" style={{ height: '15.5rem' }}>
              <ImageWithFallback
                src={event.image_url}
                alt=""
                fill
                fallbackType="default"
                sizes="37rem"
                className="object-cover"
                style={{ opacity: 0.42, transform: 'scale(1.04)' }}
              />
              {/* Layered gradient: deep bottom pull, soft top vignette */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.9) 25%, rgba(19,17,16,0.4) 55%, rgba(10,8,6,0.55) 100%)',
                }}
              />
              {/* Gold inner vignette on sides */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 120% 100% at 50% 110%, rgba(200,144,10,0.06) 0%, transparent 60%)',
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-5">
                {evThemeNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {evThemeNames.slice(0, 3).map(t => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5"
                        style={{
                          fontSize: '0.625rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'rgba(200,144,10,0.85)',
                          background: 'rgba(200,144,10,0.09)',
                          border: '1px solid rgba(200,144,10,0.18)',
                          borderRadius: '0.3125rem',
                          letterSpacing: '0.04em',
                          backdropFilter: 'blur(6px)',
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
                    fontSize: '1.4375rem',
                    color: '#f0e2c0',
                    textShadow:
                      '0 0.125rem 1.25rem rgba(200,144,10,0.25), 0 0.0625rem 0.375rem rgba(0,0,0,0.9)',
                    lineHeight: 1.25,
                    letterSpacing: '-0.01em',
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
            /* No-image header */
            <div
              className="relative overflow-hidden px-6 pt-7 pb-5"
              style={{
                background:
                  'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, transparent 60%)',
              }}
            >
              <div
                className="absolute top-0 left-0 w-full"
                style={{
                  height: '0.125rem',
                  background:
                    'linear-gradient(90deg, rgba(200,144,10,0.4), rgba(200,144,10,0.1) 55%, transparent)',
                }}
              />
              {evThemeNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {evThemeNames.slice(0, 3).map(t => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5"
                      style={{
                        fontSize: '0.625rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'rgba(200,144,10,0.85)',
                        background: 'rgba(200,144,10,0.09)',
                        border: '1px solid rgba(200,144,10,0.18)',
                        borderRadius: '0.3125rem',
                        letterSpacing: '0.04em',
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
                  fontSize: '1.3125rem',
                  color: '#f0e2c0',
                  lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                }}
              >
                {event.name ||
                  (event.desc_text
                    ? event.desc_text.split('\n')[0].slice(0, 50)
                    : `이벤트 #${event.id}`)}
              </h2>
            </div>
          )}

          {/* ── Content ──────────────────────────────────────────── */}
          <div className="px-6 pb-6 pt-5 relative">

            {/* Description paragraphs */}
            {event.desc_text &&
              (() => {
                const paragraphs = replaceEventPlaceholders(event.desc_text).split('\n\n')
                return (
                  <div
                    className="mb-5"
                    style={{
                      padding: '1rem 1.125rem',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '0.5rem',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {paragraphs.map((para, pi) => (
                      <p
                        key={pi}
                        className="whitespace-pre-line"
                        style={{
                          color: pi === 0 ? '#cebf9e' : '#a89070',
                          fontSize: '0.875rem',
                          lineHeight: 1.85,
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

            {/* ── Options ─────────────────────────────────────── */}
            {event.options && event.options.length > 0 && (
              <div className="mb-5">
                <SectionLabel>선택지</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {event.options.map((opt, i) => (
                    <OptionCard
                      key={i}
                      event={event}
                      opt={opt}
                      index={i}
                      giftByGameId={giftByGameId}
                      onSelectGift={handleSelectGift}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Acquirable gifts ─────────────────────────────── */}
            {(() => {
              const allGiftIds = new Set(event.gift_ids || [])
              const evGifts = [...allGiftIds]
                .map(gid => giftByGameId.get(gid))
                .filter(Boolean) as EgoGift[]
              if (evGifts.length === 0) return null
              return (
                <div
                  className="mb-5"
                  style={{
                    padding: '0.875rem 1rem',
                    background: 'rgba(200,144,10,0.025)',
                    border: '1px solid rgba(200,144,10,0.1)',
                    borderLeft: '0.1875rem solid rgba(200,144,10,0.35)',
                    borderRadius: '0.5rem',
                  }}
                >
                  <SectionLabel>획득 가능 기프트</SectionLabel>
                  {/* position: relative + zIndex: 0 isolates GiftCard hover z-index */}
                  <div
                    className="flex flex-wrap gap-2"
                    style={{ position: 'relative', zIndex: 0 }}
                  >
                    {evGifts.map(g => (
                      <button
                        key={g.id}
                        onClick={() => handleSelectGift(g)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                        style={{
                          cursor: 'pointer',
                          background: `${KEYWORD_COLORS[g.keyword] ?? '#666'}0c`,
                          border: `1px solid ${KEYWORD_COLORS[g.keyword] ?? '#666'}22`,
                          transition: 'background 0.2s, border-color 0.2s, transform 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `${KEYWORD_COLORS[g.keyword] ?? '#666'}18`
                          e.currentTarget.style.borderColor = `${KEYWORD_COLORS[g.keyword] ?? '#666'}40`
                          e.currentTarget.style.transform = 'translateY(-0.0625rem)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = `${KEYWORD_COLORS[g.keyword] ?? '#666'}0c`
                          e.currentTarget.style.borderColor = `${KEYWORD_COLORS[g.keyword] ?? '#666'}22`
                          e.currentTarget.style.transform = 'translateY(0)'
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

            {/* ── Theme packs ──────────────────────────────────── */}
            {event.theme_ids && event.theme_ids.length > 0 && event.theme_ids.length <= 8 && (
              <div className="mb-5">
                <SectionLabel>출현 테마팩</SectionLabel>
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '0.4375rem',
                          fontSize: '0.6875rem',
                          backdropFilter: 'blur(4px)',
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
                          {t.difficulty === 'extreme'
                            ? 'EX'
                            : t.difficulty === 'hard'
                              ? 'H'
                              : ''}
                        </span>
                      </span>
                    )
                  })}
                  {event.theme_ids.length > 20 && (
                    <span
                      style={{
                        color: '#555',
                        fontSize: '0.6875rem',
                        alignSelf: 'center',
                      }}
                    >
                      +{event.theme_ids.length - 20}개
                    </span>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </BaseModal>
  )
}
