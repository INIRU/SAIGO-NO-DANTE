'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import {
  Identity,
  SIN_COLORS,
  STORAGE_BASE,
  RARITY_ICON_MAP,
} from '@/lib/data/sinners'
import { KeywordWithTooltip } from '@/components/sinners/KeywordTooltip'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { SPECIAL_CHARGE_KEYWORDS } from '@/lib/constants/keywords'

interface IdentityInfoCardProps {
  identity: Identity
  sinColor: string
  currentSeason?: number
}

export default function IdentityInfoCard({ identity, sinColor, currentSeason = 7 }: IdentityInfoCardProps) {
  const { sinMap: kwSinMap } = useKeywordData()
  return (
    <div className="card p-6">
      <h2
        className="font-serif font-light mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        기본 정보
      </h2>

      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded"
        style={{
          background: 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        {/* 등급 */}
        <div className="flex items-center gap-2">
          {RARITY_ICON_MAP[identity.rarity] && (
            <Image
              src={RARITY_ICON_MAP[identity.rarity]}
              alt=""
              width={identity.rarity === 1 ? 16 : identity.rarity === 2 ? 28 : 40}
              height={16}
              style={{ width: identity.rarity === 1 ? '1rem' : identity.rarity === 2 ? '1.75rem' : '2.5rem', height: 'auto', filter: 'drop-shadow(0 0 3px rgba(200,144,10,0.4))' }}
            />
          )}
        </div>

        {/* 키워드 (메인 상태이상 + 특수 충전) */}
        {identity.keywords && (identity.keywords.filter(kw => kwSinMap[kw]).length > 0 || identity.keywords.some(kw => SPECIAL_CHARGE_KEYWORDS.has(kw))) && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
            <div className="flex items-center gap-2 flex-wrap">
              {identity.keywords.filter(kw => SPECIAL_CHARGE_KEYWORDS.has(kw)).map(kw => (
                <KeywordWithTooltip key={kw} keyword={kw}>
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: SIN_COLORS[kwSinMap['충전']] || '#7b68ee' }}
                  >
                    {kw}
                  </span>
                </KeywordWithTooltip>
              ))}
              {identity.keywords.filter(kw => kwSinMap[kw]).map(kw => {
                const kwColor = SIN_COLORS[kwSinMap[kw]] || '#888'
                return (
                  <KeywordWithTooltip key={kw} keyword={kw}>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: kwColor }}
                    >
                      {kw}
                    </span>
                  </KeywordWithTooltip>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 내성 */}
      {(identity.slash_res || identity.pierce_res || identity.blunt_res) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          {([
            { label: '참격', res: identity.slash_res, icon: 'slash' },
            { label: '관통', res: identity.pierce_res, icon: 'pierce' },
            { label: '타격', res: identity.blunt_res, icon: 'blunt' },
          ] as const).map(({ label, res, icon }) => {
            const resColor = res === '취약' ? '#ff6b6b' : res === '내성' ? '#6bbbff' : '#888'
            return (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
              >
                <Image
                  src={`${STORAGE_BASE}/icons/stats/${icon}.webp`}
                  alt=""
                  width={14}
                  height={14}
                  style={{ width: '0.875rem', height: '0.875rem' }}
                />
                <span style={{ color: resColor, fontSize: '0.6875rem', fontWeight: 600 }}>
                  {res}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 소속 */}
      {identity.affiliation && (
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ color: '#999', fontSize: '0.75rem', marginBottom: '6px' }}>소속</div>
          <span
            className="px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1"
            style={{
              background: `${sinColor}18`,
              color: sinColor,
              border: `1px solid ${sinColor}40`,
            }}
          >
            {identity.affiliation}
          </span>
        </div>
      )}

      {/* 출시시기 & 획득 방법 */}
      {(identity.release_date || identity.acquisition_info) && (
        <div className="mt-5 space-y-2">
          {identity.release_date && (
            <div className="flex items-center gap-2">
              <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>출시시기</span>
              <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{identity.release_date}</span>
            </div>
          )}
          {(() => {
            const info = identity.acquisition_info
            if (!info) return null

            const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
              default:    { label: '기본',      color: '#8a8a8a', bg: 'rgba(138,138,138,0.12)' },
              standard:   { label: '추출',      color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' },
              event:      { label: '이벤트',    color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' },
              walpurgis:  { label: '발푸르기스', color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' },
              attendance: { label: '출석',      color: '#a29bfe', bg: 'rgba(162,155,254,0.12)' },
            }
            const GACHA_LABELS: Record<string, { label: string; color: string }> = {
              always:   { label: '상시 추출',   color: '#6bbbff' },
              seasonal: { label: '시즌 한정',   color: '#ffa502' },
              walpurgis:{ label: '발푸밤 한정', color: '#7bed9f' },
              none:     { label: '추출 불가',   color: '#999' },
            }

            const typeInfo = TYPE_LABELS[info.type] ?? TYPE_LABELS.standard
            const gachaInfo = GACHA_LABELS[info.gacha] ?? GACHA_LABELS.none

            return (
              <div className="space-y-2">
                {/* 타입 + 시즌 배지 */}
                <div className="flex items-center gap-2">
                  <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>획득 방법</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 타입 배지 */}
                    <span
                      style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        padding: '2px 8px', borderRadius: '3px',
                        color: typeInfo.color,
                        background: typeInfo.bg,
                        border: `1px solid ${typeInfo.color}30`,
                      }}
                    >
                      {typeInfo.label}
                    </span>

                    {/* 시즌 */}
                    {info.release_season > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: '#c8900a',
                          background: 'rgba(200,144,10,0.1)',
                          border: '1px solid rgba(200,144,10,0.2)',
                        }}
                      >
                        시즌 {info.release_season}
                      </span>
                    )}

                    {/* 발푸밤 회차 */}
                    {info.walpurgis_edition && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: '#7bed9f',
                          background: 'rgba(123,237,159,0.08)',
                          border: '1px solid rgba(123,237,159,0.2)',
                        }}
                      >
                        {info.walpurgis_edition}회차
                      </span>
                    )}

                    {/* 이벤트명 */}
                    {info.event_name && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: '#ff9f43',
                          background: 'rgba(255,159,67,0.08)',
                          border: '1px solid rgba(255,159,67,0.2)',
                        }}
                      >
                        {info.event_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 추출 상태 */}
                {info.type !== 'default' && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>추출</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ fontSize: '0.75rem', color: gachaInfo.color }}>
                        {gachaInfo.label}
                        {info.gacha === 'seasonal' && info.gacha_from_season && ` (S${info.gacha_from_season}~)`}
                      </span>
                      {info.target_sinner && (
                        <span style={{ fontSize: '0.75rem', color: '#ffa502' }}>
                          · {info.target_sinner} 특정 추출
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 자판기 교환 */}
                {(info.gacha === 'seasonal' || (info.type === 'event' && info.gacha === 'none')) && (() => {
                  const releaseSeason = Number(info.release_season ?? 0)
                  const diff = currentSeason - releaseSeason
                  // 같은 시즌 신규: 출시 7일 이내는 교환 불가
                  if (diff === 0 && identity.release_date) {
                    const daysSince = Math.floor((Date.now() - new Date(identity.release_date).getTime()) / (1000 * 60 * 60 * 24))
                    if (daysSince < 7) {
                      return (
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>자판기</span>
                          <span style={{ fontSize: '0.75rem', color: '#ff6b6b' }}>교환 불가 (출시 7일 후 개방)</span>
                        </div>
                      )
                    }
                  }
                  const available = diff !== 1
                  return (
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>자판기</span>
                      <span style={{ fontSize: '0.75rem', color: available ? '#7bed9f' : '#ff6b6b' }}>
                        {available ? '교환 가능' : '교환 불가 (다음 시즌부터 가능)'}
                      </span>
                    </div>
                  )
                })()}

                {/* 파편 교환 */}
                {info.fragment_cost && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>파편 교환</span>
                    <span style={{ fontSize: '0.75rem', color: '#bbb' }}>
                      자아 파편 {info.fragment_cost}
                      {info.exchange_from_season
                        ? ` (S${info.exchange_from_season}~ 상시)`
                        : info.gacha === 'always' ? ' (상시)' : ''
                      }
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
      {/* SD 일러스트 */}
      {identity.game_id && identity.folder_name && (
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div
            className="relative w-full overflow-hidden rounded-xl"
            style={{
              aspectRatio: '16/9',
              background: '#0a0908',
              border: `1px solid ${sinColor}20`,
            }}
          >
            {/* 배경: BG 이미지 또는 일러스트 blur */}
            {identity.bg_image_url ? (
              <Image
                src={identity.bg_image_url}
                alt=""
                fill
                sizes="20rem"
                className="object-contain"
                style={{ opacity: 0.5 }}
              />
            ) : (
              <Image
                src={`${STORAGE_BASE}/sinners/${identity.sinner_id}/identities/${identity.folder_name}/${identity.game_id}_normal.webp`}
                alt=""
                fill
                sizes="20rem"
                className="object-cover"
                style={{ opacity: 0.25, filter: 'blur(8px) saturate(1.2) brightness(0.8)', transform: 'scale(1.1)' }}
              />
            )}
            {/* 하단 그라디언트 */}
            <div className="absolute" style={{
              inset: '-1px',
              background: `linear-gradient(180deg, rgba(10,9,8,0.2) 0%, transparent 30%, transparent 60%, rgba(10,9,8,0.7) 100%)`,
            }} />
            {/* SD 캐릭터 — 드래그+줌 */}
            <SDCharacter
              src={`${STORAGE_BASE}/icons/sd/${identity.sinner_id}/${identity.game_id}_idle.webp`}
              alt={`${identity.name_kr || identity.name} SD`}
              onError={() => {
                // 컨테이너 숨김
                const el = document.getElementById(`sd-container-${identity.game_id}`)
                if (el) el.style.display = 'none'
              }}
            />
          </div>
          <p className="text-center mt-2" style={{ color: '#555', fontSize: '0.625rem' }}>
            드래그로 이동 · 스크롤로 확대/축소 · 더블클릭으로 초기화
          </p>
        </div>
      )}
    </div>
  )
}

/* ── SD 캐릭터 드래그+줌 컴포넌트 ── */
function SDCharacter({ src, alt, onError }: { src: string; alt: string; onError: () => void }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // wheel 이벤트를 non-passive로 등록해야 preventDefault 가능
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setScale(s => Math.min(3, Math.max(0.3, s - e.deltaY * 0.002)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPos(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const handleReset = useCallback(() => {
    setScale(1)
    setPos({ x: 0, y: 0 })
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleReset}
      style={{ cursor: dragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      <div
        className="absolute inset-0 flex items-end justify-center pb-4"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: dragging.current ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <div className="relative" style={{ width: '70%', height: '85%' }}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 640px) 70vw, 14rem"
            className="object-contain object-bottom pointer-events-none"
            style={{ filter: 'drop-shadow(0 0.25rem 1rem rgba(0,0,0,0.6))' }}
            onError={onError}
          />
        </div>
      </div>
      {/* 줌 표시 */}
      {scale !== 1 && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.5)', color: '#888', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
          {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  )
}
