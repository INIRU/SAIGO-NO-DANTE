'use client'

import { useState } from 'react'
import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  getSinnerLogoUrl,
  getSinnerProfileUrl,
  getSkillIconUrl,
  STORAGE_BASE,
  SIN_COLORS,
  SinType,
  GRADE_COLORS,
} from '@/lib/data/sinners'
import IdentityCard from '@/components/sinners/IdentityCard'
import BaseModal from '@/components/ui/BaseModal'

/* ── 수감자 빈 카드 (공통) ────────────────────────────── */
function SinnerGhostCard({ sinner, children }: { sinner: Sinner; children?: React.ReactNode }) {
  const profileUrl = getSinnerProfileUrl(sinner.id)
  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: '2/3',
        background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
        border: '0.09375rem dashed #2a2015',
        borderRadius: '0.25rem',
        overflow: 'hidden',
      }}
    >
      {profileUrl && (
        <Image src={profileUrl} alt={sinner.name} fill className="object-cover object-top" style={{ opacity: 0.18 }} sizes="120px" />
      )}
      <div className="absolute" style={{ top: 0, right: 0, width: '36%', opacity: 0.2, pointerEvents: 'none' }}>
        <Image src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`} alt="" width={389} height={1023} className="w-full h-auto" />
      </div>
      {children}
      <div className="absolute bottom-0 left-0 right-0 text-center pb-1.5 z-10" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)', paddingTop: '1.25rem' }}>
        <p className="font-serif font-light" style={{ color: '#3a2a10', fontSize: '0.625rem' }}>{sinner.name_kr}</p>
      </div>
    </div>
  )
}

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const SKILL_PRESETS: [number, number, number][] = [[3, 2, 1], [1, 0, 5], [0, 0, 6]]

/* ── 탭 1: 인격 편성 (플래너 패턴: 40% 변경 / 60% 편성 토글) ── */
export function IdentityTab({
  sinners, identities, deckSlots, gacksungSlots, onGacksungToggle,
  formationOrder, onFormationToggle, onIdentitySelect, onIdentityDeselect,
}: {
  sinners: Sinner[]
  identities: Identity[]
  deckSlots: Record<string, Identity | undefined>
  gacksungSlots: Record<string, boolean>
  onGacksungToggle: (sinnerId: string) => void
  formationOrder: string[]
  onFormationToggle: (sinnerId: string) => void
  onIdentitySelect: (identity: Identity) => void
  onIdentityDeselect: (sinnerId: string) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) : null
  const modalIdentities = modalSinnerId ? identities.filter(i => i.sinner_id === modalSinnerId).sort((a, b) => b.rarity - a.rarity) : []

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        const isGacksung = gacksungSlots[sinner.id] ?? false
        const formIdx = formationOrder.indexOf(sinner.id)
        const isFormed = formIdx >= 0

        return (
          <div key={sinner.id} className="relative" style={{ overflow: 'visible' }}>
            <div
              className="group cursor-pointer relative w-full"
              style={{
                aspectRatio: '2/3',
                background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                border: `0.09375rem ${identity ? 'solid' : 'dashed'} ${identity ? (isFormed ? 'rgba(200,144,10,0.5)' : '#2a2015') : '#2a2015'}`,
                borderRadius: '0.25rem',
                overflow: 'hidden',
                boxShadow: identity && isFormed ? '0 0 0.5rem rgba(200,144,10,0.2)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {identity ? (
                <>
                  <Image
                    src={`${STORAGE_BASE}/sinners/${identity.sinner_id}/identities/${identity.folder_name}/${identity.game_id}_${isGacksung ? 'gacksung' : 'normal'}_info.webp`}
                    alt={identity.name_kr}
                    fill
                    className="object-cover object-top"
                    sizes="180px"
                  />
                  {/* 이름 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 text-center" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)', paddingTop: '1.5rem', paddingBottom: '0.375rem' }}>
                    <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.8125rem', lineHeight: 1.2 }}>{identity.name_kr}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={32} height={32} style={{ width: '2rem', height: '2rem', opacity: 0.35 }} />
                  </div>
                  <div className="absolute" style={{ top: 0, right: 0, width: '36%', opacity: 0.15, pointerEvents: 'none' }}>
                    <Image src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`} alt="" width={389} height={1023} className="w-full h-auto" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 text-center z-10" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)', paddingTop: '1.25rem', paddingBottom: '0.375rem' }}>
                    <p className="font-serif font-light" style={{ color: '#3a2a10', fontSize: '0.75rem' }}>{sinner.name_kr}</p>
                  </div>
                </>
              )}

              {/* 편성 순서 오버레이 */}
              {identity && isFormed && (
                <div className="absolute inset-0 flex items-center justify-center z-[15] pointer-events-none" style={{ background: 'rgba(13,11,8,0.5)' }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'var(--font-body)', color: '#e8b030', textShadow: '0 0 0.75rem rgba(200,144,10,0.7), 0 0.125rem 0.5rem rgba(0,0,0,1)' }}>편성</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: '#e8b030', textShadow: '0 0 1rem rgba(200,144,10,0.7), 0 0.125rem 0.5rem rgba(0,0,0,1)', marginLeft: '0.25rem' }}>{formIdx + 1}</span>
                </div>
              )}

              {/* 호버 오버레이 — 40% 변경 / 60% 편성 토글 */}
              <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col" style={{ backdropFilter: 'blur(0.375rem) brightness(0.4)', WebkitBackdropFilter: 'blur(0.375rem) brightness(0.4)' }}>
                {identity ? (
                  <>
                    <div
                      onClick={() => setModalSinnerId(sinner.id)}
                      className="flex items-center justify-center transition-colors"
                      style={{ height: '40%', background: 'rgba(13,11,8,0.6)', borderBottom: '1px solid rgba(200,144,10,0.2)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.6)' }}
                    >
                      <span style={{ color: '#e8b030', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-body)', textShadow: '0 0 0.5rem rgba(200,144,10,0.5), 0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>변경</span>
                    </div>
                    <div
                      onClick={() => onFormationToggle(sinner.id)}
                      className="flex items-center justify-center transition-colors"
                      style={{ height: '60%', background: 'rgba(13,11,8,0.5)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = isFormed ? 'rgba(90,176,208,0.12)' : 'rgba(200,144,10,0.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                    >
                      <span style={{ color: isFormed ? '#5ab0d0' : '#e8b030', fontSize: '0.75rem', fontWeight: 600, textShadow: '0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>
                        {isFormed ? '편성 해제' : '편성하기'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => setModalSinnerId(sinner.id)}
                    className="flex items-center justify-center transition-colors"
                    style={{ height: '100%', background: 'rgba(13,11,8,0.5)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.12)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                  >
                    <span style={{ color: '#e8b030', fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-body)', textShadow: '0 0 0.5rem rgba(200,144,10,0.5), 0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>편성</span>
                  </div>
                )}
              </div>
            </div>

            {/* 각성 토글 */}
            {identity && (
              <button
                onClick={e => { e.stopPropagation(); onGacksungToggle(sinner.id) }}
                title={isGacksung ? '각성 일러스트 — 클릭하여 일반으로' : '일반 일러스트 — 클릭하여 각성으로'}
                style={{
                  position: 'absolute', top: '-0.4375rem', right: '-0.4375rem', zIndex: 20,
                  width: '1.375rem', height: '1.375rem', borderRadius: '50%',
                  background: isGacksung ? 'rgba(200,144,10,0.92)' : 'rgba(18,14,9,0.92)',
                  border: `0.09375rem solid ${isGacksung ? '#c8900a' : '#2a2015'}`,
                  color: isGacksung ? '#0d0b08' : '#5a4830',
                  fontSize: '0.8125rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isGacksung ? '0 0 0.5rem rgba(200,144,10,0.5)' : 'none',
                  transition: 'all 0.2s', lineHeight: 1,
                }}
              >
                &#x21BA;
              </button>
            )}
          </div>
        )
      })}
    </div>

    {/* ── 인격 선택 모달 (플래너 패턴) ── */}
    <BaseModal open={!!(modalSinnerId && modalSinner)} onClose={() => setModalSinnerId(null)} maxWidth="48rem" padding="1rem">
      {modalSinnerId && modalSinner && (
        <div
          style={{ background: 'var(--bg-card)', border: '1px solid #333', borderRadius: 'var(--radius-lg)', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
        >
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between sticky top-0 z-10" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Image src={getSinnerLogoUrl(modalSinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="font-serif" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{modalSinner.name_kr} — 인격 선택</span>
            </div>
            <button onClick={() => setModalSinnerId(null)} style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
          </div>

          {/* 선택 해제 버튼 */}
          {deckSlots[modalSinnerId] && (
            <div style={{ padding: '0.75rem 1.25rem 0' }}>
              <button
                onClick={() => { onIdentityDeselect(modalSinnerId); setModalSinnerId(null) }}
                className="w-full transition-colors"
                style={{ color: 'var(--error)', fontSize: 'var(--text-sm)', border: '1px solid rgba(200,48,48,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', cursor: 'pointer', background: 'rgba(200,48,48,0.05)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                ✕ 선택 해제
              </button>
            </div>
          )}

          {/* 인격 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" style={{ padding: '1rem 1.25rem 1.25rem' }}>
            {modalIdentities.map(ident => {
              const isSelected = deckSlots[modalSinnerId]?.id === ident.id
              return (
                <button
                  key={ident.id}
                  onClick={() => { onIdentitySelect(ident); setModalSinnerId(null) }}
                  className="text-left transition-all"
                  style={{
                    background: isSelected ? 'linear-gradient(160deg, rgba(200,144,10,0.15) 0%, rgba(200,144,10,0.05) 100%)' : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                    border: `0.09375rem solid ${isSelected ? 'var(--gold)' : 'rgba(42,32,21,0.5)'}`,
                    borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0.75rem rgba(200,144,10,0.3)' : 'none',
                  }}
                >
                  <div className="relative w-full" style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                    {ident.game_id && ident.folder_name && (
                      <Image
                        src={`${STORAGE_BASE}/sinners/${ident.sinner_id}/identities/${ident.folder_name}/${ident.game_id}_normal_info.webp`}
                        alt={ident.name_kr}
                        fill
                        className="object-cover object-top"
                        sizes="200px"
                      />
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 z-10" style={{ background: 'rgba(200,144,10,0.1)', border: '0.125rem solid var(--gold)', borderRadius: 'var(--radius-sm)' }} />
                    )}
                  </div>
                  <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                    <p className="font-serif truncate" style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 'var(--text-xs)', lineHeight: 1.3 }}>
                      {ident.name_kr}
                    </p>
                    {ident.keywords && ident.keywords.length > 0 && (
                      <p className="truncate" style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        {ident.keywords.join(' / ')}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </BaseModal>
    </>
  )
}

/* ── 탭 2: 에고 편성 ─────────────────────────────────── */
export function EgoTab({
  sinners, egos, egoSlots, onEgoSelect, onEgoDeselect,
}: {
  sinners: Sinner[]
  egos: EGO[]
  egoSlots: Record<string, Record<string, EGO>>
  onEgoSelect: (ego: EGO) => void
  onEgoDeselect: (sinnerId: string, grade: string) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) : null
  const modalEgos = modalSinnerId ? egos.filter(e => e.sinner_id === modalSinnerId) : []

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
      {sinners.map(sinner => {
        const sinnerEgos = egoSlots[sinner.id] ?? {}
        return (
          <div
            key={sinner.id}
            onClick={() => setModalSinnerId(sinner.id)}
            style={{
              background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
              border: '1px solid #221a0f',
              borderRadius: '0.25rem',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            {/* 수감자 헤더 */}
            <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: '1px solid #1a1208' }}>
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} unoptimized />
              <span className="font-serif font-light truncate" style={{ color: '#4a3520', fontSize: '0.5625rem' }}>{sinner.name_kr}</span>
            </div>
            {/* 등급 세로 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
              {GRADE_ORDER.map(grade => {
                const ego = sinnerEgos[grade]
                const gc = GRADE_COLORS[grade]
                const sc = ego?.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                return (
                  <div
                    key={grade}
                    style={{
                      background: ego ? `${sc}1a` : 'rgba(10,8,5,0.7)',
                      border: `1px solid ${ego ? sc + '55' : '#18120a'}`,
                      borderRadius: '0.125rem',
                      padding: '0.25rem 0.3125rem',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '0.3125rem',
                      minHeight: '1.5rem',
                    }}
                  >
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={22}
                        height={11}
                        unoptimized
                        style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ color: ego ? sc : gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                    )}
                    {ego
                      ? <span style={{ color: sc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, wordBreak: 'keep-all', flex: 1, textAlign: 'left' }}>{ego.name_kr || ego.name}</span>
                      : <span style={{ color: '#2a1e10', fontSize: '0.75rem', lineHeight: 1 }}>+</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>

    {/* ── 에고 선택 모달 (수감자별, 전 등급 동시 표시) ── */}
    <BaseModal open={!!(modalSinnerId && modalSinner)} onClose={() => setModalSinnerId(null)} maxWidth="42rem" padding="1rem">
      {modalSinnerId && modalSinner && (
        <div
          className="flex flex-col"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', maxHeight: '85vh', boxShadow: 'var(--shadow-lg)' }}
        >
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between flex-shrink-0 sticky top-0 z-10" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
            <div className="flex items-center gap-2">
              <Image src={getSinnerLogoUrl(modalSinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="font-serif" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{modalSinner.name_kr} — E.G.O 선택</span>
            </div>
            <button onClick={() => setModalSinnerId(null)} style={{ color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
          </div>

          {/* 등급별 섹션 */}
          <div className="overflow-y-auto flex-1" style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
            {GRADE_ORDER.map(grade => {
              const gc = GRADE_COLORS[grade] ?? '#667788'
              const gradeEgos = modalEgos.filter(e => e.grade === grade)
              const selectedEgo = egoSlots[modalSinnerId]?.[grade]
              return (
                <div key={grade} style={{ marginBottom: '1.25rem' }}>
                  {/* 등급 헤더 */}
                  <div className="flex items-center gap-2" style={{ marginBottom: '0.625rem' }}>
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={32}
                        height={16}
                        unoptimized
                        style={{ height: '1rem', width: 'auto', opacity: 0.85 }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: gc, letterSpacing: '0.1em' }}>ALEPH</span>
                    )}
                    <div style={{ flex: 1, height: '1px', background: `${gc}33` }} />
                    {selectedEgo && (
                      <button
                        onClick={() => onEgoDeselect(modalSinnerId, grade)}
                        style={{
                          color: '#cc4444', fontSize: '0.625rem', cursor: 'pointer',
                          border: '1px solid rgba(200,48,32,0.3)', borderRadius: '0.25rem',
                          padding: '0.1875rem 0.5rem', background: 'rgba(200,48,32,0.05)',
                          lineHeight: 1.4,
                        }}
                      >해제</button>
                    )}
                  </div>

                  {gradeEgos.length === 0 ? (
                    <p style={{ color: '#3a2e20', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', paddingLeft: '0.25rem' }}>없음</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {gradeEgos.map(ego => {
                        const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                        const isSelected = selectedEgo?.id === ego.id
                        return (
                          <button
                            key={ego.id}
                            onClick={() => onEgoSelect(ego)}
                            className="flex flex-col items-center gap-1.5"
                            style={{ cursor: 'pointer' }}
                          >
                            <div style={{
                              position: 'relative', width: '5.625rem', height: '5.625rem',
                              borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                              border: `0.125rem solid ${isSelected ? 'var(--gold)' : sc + '55'}`,
                              boxShadow: isSelected ? `0 0 1rem rgba(200,144,10,0.6)` : `0 0 0.375rem ${sc}25`,
                              background: '#0d0a06', transition: 'all 0.2s',
                            }}>
                              {ego.image_url
                                ? <Image src={ego.image_url} alt="" fill className="object-cover" style={{ objectPosition: '50% 10%' }} sizes="90px" />
                                : <div className="w-full h-full flex items-center justify-center"><span style={{ fontFamily: 'monospace', color: gc, fontSize: '0.75rem' }}>{ego.grade?.[0]}</span></div>
                              }
                            </div>
                            <p className="font-serif font-light leading-snug text-center" style={{ color: isSelected ? '#f0d060' : '#c8a450', fontSize: '0.6875rem' }}>{ego.name_kr || ego.name}</p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </BaseModal>
    </>
  )
}

/* ── 탭 3: 편성 순서 ─────────────────────────────────── */
export function OrderTab({
  sinners, deckSlots, formationOrder, onToggle,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  formationOrder: string[]
  onToggle: (sinnerId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const idx = formationOrder.indexOf(sinner.id)
        const position = idx === -1 ? 0 : idx + 1
        const isAssigned = position > 0
        const isBattle = position <= 7
        const color = isBattle ? '#c83020' : '#3870b0'
        const identity = deckSlots[sinner.id]

        return (
          <div
            key={sinner.id}
            onClick={() => onToggle(sinner.id)}
            className="relative cursor-pointer"
            style={{ overflow: 'visible' }}
          >
            {identity ? (
              <IdentityCard identity={identity} compact />
            ) : (
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} style={{ height: 'auto', opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            )}

            <div
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                zIndex: 20,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isAssigned ? color : 'rgba(20,16,10,0.9)',
                border: isAssigned ? `2px solid ${color}` : '1.5px dashed rgba(200,144,10,0.3)',
                boxShadow: isAssigned ? `0 0 10px ${color}88` : 'none',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            >
              {isAssigned ? (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.375rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>
                    {isBattle ? 'B' : 'S'}
                  </span>
                  <span style={{ color: '#fff', fontSize: '0.8125rem', fontFamily: 'var(--font-title)', fontWeight: 700, lineHeight: 1 }}>
                    {position}
                  </span>
                </>
              ) : (
                <span style={{ color: 'rgba(200,144,10,0.4)', fontSize: '1rem', lineHeight: 1 }}>+</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 탭 4: 스킬 배분 ─────────────────────────────────── */
export function SkillsetTab({
  sinners, deckSlots, skillsByIdentityId, skillDistribution, onDistributionChange,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  skillsByIdentityId: Record<string, Skill[]>
  skillDistribution: Record<string, [number, number, number]>
  onDistributionChange: (sinnerId: string, dist: [number, number, number]) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        if (!identity) {
          return (
            <div key={sinner.id}>
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} style={{ height: 'auto', opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            </div>
          )
        }

        const dist = skillDistribution[sinner.id] ?? [3, 2, 1]
        const total = dist[0] + dist[1] + dist[2]
        const isDefault = dist[0] === 3 && dist[1] === 2 && dist[2] === 1
        const skills = (skillsByIdentityId[identity.id] ?? [])
          .filter(s => s.skill_order >= 1 && s.skill_order <= 3)
          .sort((a, b) => a.skill_order - b.skill_order)
          .filter((s, i, arr) => arr.findIndex(x => x.skill_order === s.skill_order) === i)

        const handleChange = (idx: number, delta: number) => {
          const next: [number, number, number] = [dist[0], dist[1], dist[2]]
          const newVal = next[idx] + delta
          if (newVal < 0 || total + delta > 6) return
          next[idx] = newVal
          onDistributionChange(sinner.id, next)
        }

        return (
          <div key={sinner.id}>
            <IdentityCard identity={identity} compact />
            <div style={{
              marginTop: '6px',
              background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
              border: `1px solid ${isDefault ? '#221a0f' : 'rgba(200,144,10,0.4)'}`,
              borderRadius: '4px',
              padding: '6px',
            }}>
              {[0, 1, 2].map(idx => {
                const skill = skills[idx]
                const sinColor = skill ? (SIN_COLORS[skill.sin_affinity] ?? '#888') : '#555'
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}>
                    {skill && identity.game_id ? (
                      <ImageWithFallback
                        src={getSkillIconUrl(identity, skill.skill_order)}
                        alt={skill.name}
                        width={16}
                        height={16}
                        fallbackType="skill"
                        style={{ borderRadius: '2px', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: '#1a1510', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '0.5625rem', color: sinColor, fontFamily: 'var(--font-mono)', fontWeight: 700, width: '18px', flexShrink: 0 }}>
                      S{idx + 1}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => handleChange(idx, -1)}
                      disabled={dist[idx] <= 0}
                      style={{
                        width: '18px', height: '18px', borderRadius: '2px',
                        background: dist[idx] <= 0 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                        border: `1px solid ${dist[idx] <= 0 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                        color: dist[idx] <= 0 ? '#2a2015' : '#c8900a',
                        fontSize: '0.75rem', cursor: dist[idx] <= 0 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, padding: 0,
                      }}
                    >
                      −
                    </button>
                    <span style={{
                      width: '16px', textAlign: 'center', fontSize: '0.8125rem',
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: dist[idx] === 0 ? '#3a2a10' : sinColor,
                    }}>
                      {dist[idx]}
                    </span>
                    <button
                      onClick={() => handleChange(idx, 1)}
                      disabled={total >= 6}
                      style={{
                        width: '18px', height: '18px', borderRadius: '2px',
                        background: total >= 6 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                        border: `1px solid ${total >= 6 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                        color: total >= 6 ? '#2a2015' : '#c8900a',
                        fontSize: '0.75rem', cursor: total >= 6 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, padding: 0,
                      }}
                    >
                      +
                    </button>
                  </div>
                )
              })}
              {/* 합계 + 프리셋 */}
              <div style={{
                borderTop: '1px solid #1a1208', marginTop: '4px', paddingTop: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: total === 6 ? '#5a8a40' : '#c83020',
                }}>
                  {total}/6
                </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {SKILL_PRESETS.map(preset => {
                    const active = dist[0] === preset[0] && dist[1] === preset[1] && dist[2] === preset[2]
                    return (
                      <button
                        key={preset.join(',')}
                        onClick={() => onDistributionChange(sinner.id, preset)}
                        style={{
                          fontSize: '0.5rem', fontFamily: 'var(--font-mono)',
                          padding: '1px 4px', borderRadius: '2px',
                          background: active ? 'rgba(200,144,10,0.2)' : 'transparent',
                          border: `1px solid ${active ? 'rgba(200,144,10,0.5)' : '#18120a'}`,
                          color: active ? '#c8900a' : '#444',
                          cursor: 'pointer', lineHeight: 1.4,
                        }}
                      >
                        {preset.join('/')}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
