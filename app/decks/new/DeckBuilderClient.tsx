'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { formatSkillDesc } from '@/components/sinners/KeywordTooltip'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
  getSinnerProfileUrl,
  getSinnerLogoUrl,
  getIdentityInfoUrl,
  getSkillIconUrl,
  computeSkillImageIndices,
  STORAGE_BASE,
  SIN_COLORS,
  SinType,
  GRADE_COLORS,
  SIN_LABELS_KR,
  SIN_ICON_MAP,
  ATK_TYPE_ICON_MAP,
  getKeywordIconUrl,
  type ActivationCondition,
} from '@/lib/data/sinners'
import {
  NoteRenderer,
  type NoteSkillEntry,
  type NotePassiveEntry,
  type NoteEgoEntry,
  type NoteEgoGiftEntry,
} from '@/components/decks/NoteChips'
import { useNoteAutocomplete, NoteAutocompleteDropdown, buildKeywordPool, buildEgoGiftPool, type AutocompleteSuggestion } from '@/components/notes/NoteAutocomplete'
import IdentityCard from '@/components/sinners/IdentityCard'

interface EditMode {
  deckId: string
  title: string
  description: string
  tags: string[]
  content_type?: string
  identitySlotIds: Record<string, string>
  gacksungSlots: Record<string, boolean>
  skillDistribution?: Record<string, [number, number, number]>
  formationOrder: string[]
  egoSlotIds: Record<string, Record<string, string>>
}

const CONTENT_TYPES = ['스토리', '거던5층', '거던10층', '거던15층', '거굴철'] as const
type ContentType = typeof CONTENT_TYPES[number]

const CONTENT_TYPE_BTN_COLORS: Record<ContentType, { bg: string; color: string; border: string }> = {
  '스토리':   { bg: 'rgba(80,120,200,0.2)', color: '#6090d0', border: 'rgba(80,120,200,0.5)' },
  '거던5층':  { bg: 'rgba(60,160,100,0.2)', color: '#50b878', border: 'rgba(60,160,100,0.5)' },
  '거던10층': { bg: 'rgba(60,160,100,0.2)', color: '#50b878', border: 'rgba(60,160,100,0.5)' },
  '거던15층': { bg: 'rgba(60,160,100,0.2)', color: '#50b878', border: 'rgba(60,160,100,0.5)' },
  '거굴철':   { bg: 'rgba(200,70,70,0.2)', color: '#d06060', border: 'rgba(200,70,70,0.5)' },
}

interface Props {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  skills: Skill[]
  passives: Passive[]
  egoGifts?: { name: string; keyword: string; grade: string; image_url: string | null; effect_base: string | null; activation_condition: ActivationCondition | null }[]
  editMode?: EditMode
}

type Tab = 'identity' | 'ego' | 'skillset' | 'order' | 'note'

const SIN_ORDER: SinType[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']

const RES_COLORS: Record<string, string> = {
  '효율': '#c83040', '취약': '#c83040',
  '보통': '#888899',
  '내성': '#4898b0', '견딤': '#4898b0',
  '무효': '#334455',
}

/* ── 수감자 빈 카드 (공통) ────────────────────────────── */
function SinnerGhostCard({ sinner, children }: { sinner: Sinner; children?: React.ReactNode }) {
  const profileUrl = getSinnerProfileUrl(sinner.id)
  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: '2/3',
        background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
        border: '1.5px dashed #2a2015',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {profileUrl && (
        <Image src={profileUrl} alt={sinner.name} fill unoptimized className="object-cover object-top" style={{ opacity: 0.18 }} />
      )}
      <div className="absolute" style={{ top: 0, right: 0, width: '36%', opacity: 0.2, pointerEvents: 'none' }}>
        <Image src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`} alt="" width={389} height={1023} unoptimized className="w-full h-auto" />
      </div>
      {children}
      <div className="absolute bottom-0 left-0 right-0 text-center pb-1.5 z-10" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)', paddingTop: '20px' }}>
        <p className="font-serif font-bold" style={{ color: '#3a2a10', fontSize: '0.625rem' }}>{sinner.name_kr}</p>
      </div>
    </div>
  )
}

/* ── 탭 1: 인격 편성 ─────────────────────────────────── */
function IdentityTab({
  sinners, deckSlots, onCardClick, gacksungSlots, onGacksungToggle,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  onCardClick: (sinnerId: string) => void
  gacksungSlots: Record<string, boolean>
  onGacksungToggle: (sinnerId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        const isGacksung = gacksungSlots[sinner.id] ?? false
        return (
          <div key={sinner.id} className="relative cursor-pointer" style={{ overflow: 'visible' }} onClick={() => onCardClick(sinner.id)}>
            {identity ? (
              <>
                <IdentityCard identity={identity} compact gacksung={isGacksung} />
                <button
                  onClick={e => { e.stopPropagation(); onGacksungToggle(sinner.id) }}
                  title={isGacksung ? '각성 일러스트 — 클릭하여 일반으로' : '일반 일러스트 — 클릭하여 각성으로'}
                  style={{
                    position: 'absolute', top: '-7px', right: '-7px', zIndex: 20,
                    width: 22, height: 22, borderRadius: '50%',
                    background: isGacksung ? 'rgba(200,144,10,0.92)' : 'rgba(18,14,9,0.92)',
                    border: `1.5px solid ${isGacksung ? '#c8900a' : '#2a2015'}`,
                    color: isGacksung ? '#0d0b08' : '#5a4830',
                    fontSize: '0.8125rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isGacksung ? '0 0 8px rgba(200,144,10,0.5)' : 'none',
                    transition: 'all 0.2s',
                    lineHeight: 1,
                  }}
                >
                  ↺
                </button>
              </>
            ) : (
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} unoptimized style={{ opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            )}
          </div>
        )
      })}
    </div>
  )
}

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

/* ── 탭 2: 에고 편성 ─────────────────────────────────── */
function EgoTab({
  sinners, egoSlots, onGradeClick,
}: {
  sinners: Sinner[]
  egoSlots: Record<string, Record<string, EGO>>
  onGradeClick: (sinnerId: string, grade: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
      {sinners.map(sinner => {
        const sinnerEgos = egoSlots[sinner.id] ?? {}
        return (
          <div key={sinner.id} style={{
            background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
            border: '1px solid #221a0f',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            {/* 수감자 헤더 */}
            <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: '1px solid #1a1208' }}>
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} unoptimized style={{ opacity: 0.5 }} />
              <span className="font-serif font-bold truncate" style={{ color: '#4a3520', fontSize: '0.5625rem' }}>{sinner.name_kr}</span>
            </div>
            {/* 등급 세로 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px' }}>
              {GRADE_ORDER.map(grade => {
                const ego = sinnerEgos[grade]
                const gc = GRADE_COLORS[grade]
                const sc = ego?.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                return (
                  <button
                    key={grade}
                    onClick={() => onGradeClick(sinner.id, grade)}
                    style={{
                      background: ego ? `${sc}1a` : 'rgba(10,8,5,0.7)',
                      border: `1px solid ${ego ? sc + '55' : '#18120a'}`,
                      borderRadius: '2px',
                      padding: '4px 5px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s',
                      minHeight: '24px',
                    }}
                  >
                    {/* 등급 아이콘 */}
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={22}
                        height={11}
                        unoptimized
                        style={{ height: '11px', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ color: ego ? sc : gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                    )}
                    {ego
                      ? <span style={{ color: sc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, wordBreak: 'keep-all', flex: 1, textAlign: 'left' }}>{ego.name_kr || ego.name}</span>
                      : <span style={{ color: '#2a1e10', fontSize: '0.75rem', lineHeight: 1 }}>+</span>
                    }
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 탭 3: 편성 순서 ─────────────────────────────────── */
function OrderTab({
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
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} unoptimized style={{ opacity: 0.35 }} />
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

/* ── 탭 2.5: 거전 (스킬 배분) ────────────────────────── */
const SKILL_PRESETS: [number, number, number][] = [[3, 2, 1], [1, 0, 5], [0, 0, 6]]

function SkillsetTab({
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
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} unoptimized style={{ opacity: 0.35 }} />
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
                      <Image
                        src={getSkillIconUrl(identity, skill.skill_order)}
                        alt={skill.name}
                        width={16}
                        height={16}
                        unoptimized
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

// 수감자별 기본 E.G.O (name_kr 기준)
const DEFAULT_EGO_NAMES: Record<string, string> = {
  '이상':    '오감도',
  '파우스트': '표사 방출기',
  '돈키호테': '라 상그레 산초',
  '료슈':    '삼라영삼',
  '뫼르소':  '타인의 사슬',
  '홍루':    '허환경',
  '이스마엘': '작살박이',
  '오티스':  '토 파토스 마토스',
  '그레고르': '어느날 갑자기',
}

/* ── 덱 코드 헬퍼 ──────────────────────────────────── */
// 비트 읽기/쓰기 (start0: 0-indexed)
function readBits(bits: string, start0: number, length: number): number {
  const s = bits.slice(start0, start0 + length)
  return s.length ? parseInt(s, 2) : 0
}
function writeBitsArr(arr: string[], start0: number, length: number, value: number) {
  const s = value.toString(2).padStart(length, '0')
  for (let i = 0; i < length; i++) arr[start0 + i] = s[i]
}

// 출시 순서 정렬 (game_id 기준)
function sortedIdentities(list: Identity[]): Identity[] {
  return [...list].sort((a, b) => {
    const aId = a.game_id ? parseInt(a.game_id) : 99999
    const bId = b.game_id ? parseInt(b.game_id) : 99999
    return aId - bId
  })
}

// 비트 위치 (0-indexed, sinner block 내 상대 위치)
// 1-indexed 문서 기준: 5-8=identity, 9-12=formation, 16-19=ZAYIN, 23-26=TETH, 30-33=HE, 37-40=WAW
const CODE_BIT_POSITIONS = {
  identity:  4,  // 0-indexed = 1-indexed - 1
  formation: 8,
  ZAYIN:     15,
  TETH:      22,
  HE:        29,
  WAW:       36,
} as const

async function decodeDeckCode(
  code: string,
  sinners: Sinner[],
  identities: Identity[],
  egos: EGO[],
): Promise<{ deckSlots: Record<string, Identity | undefined>; egoSlots: Record<string, Record<string, EGO>>; formationOrder: string[] } | null> {
  try {
    // 1) base64 decode → compressed bytes
    const compressed = Uint8Array.from(atob(code), c => c.charCodeAt(0))
    // 2) gzip decompress
    const ds = new DecompressionStream('gzip')
    const w = ds.writable.getWriter()
    w.write(compressed); w.close()
    const decompBuf = await new Response(ds.readable).arrayBuffer()
    const b64str = new TextDecoder().decode(decompBuf)
    // 3) base64 decode → bytes
    const bytes = Uint8Array.from(atob(b64str), c => c.charCodeAt(0))
    // 4) bytes → bits
    const bits = Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join('')
    if (bits.length < 560) return null

    const sorted = [...sinners].sort((a, b) => a.order_num - b.order_num)
    const deckSlots: Record<string, Identity | undefined> = {}
    const egoSlots: Record<string, Record<string, EGO>> = {}
    const formEntries: { sinnerId: string; order: number }[] = []

    for (let si = 0; si < 12; si++) {
      const sinner = sorted[si]
      if (!sinner) continue
      const off = si * 46
      const sinnerIds = sortedIdentities(identities.filter(i => i.sinner_id === sinner.id))
      const sinnerEgos = egos.filter(e => e.sinner_id === sinner.id)
        .sort((a, b) => parseInt(a.game_id ?? '99999') - parseInt(b.game_id ?? '99999'))

      const idxOrder = readBits(bits, off + CODE_BIT_POSITIONS.identity, 4)
      if (idxOrder > 0 && idxOrder <= sinnerIds.length) {
        deckSlots[sinner.id] = sinnerIds[idxOrder - 1]
      }

      const formOrder = readBits(bits, off + CODE_BIT_POSITIONS.formation, 4)
      if (formOrder > 0) formEntries.push({ sinnerId: sinner.id, order: formOrder })

      const gradeMap: Record<string, number> = {
        ZAYIN: CODE_BIT_POSITIONS.ZAYIN,
        TETH:  CODE_BIT_POSITIONS.TETH,
        HE:    CODE_BIT_POSITIONS.HE,
        WAW:   CODE_BIT_POSITIONS.WAW,
      }
      const sinnerEgoMap: Record<string, EGO> = {}
      for (const [grade, bitPos] of Object.entries(gradeMap)) {
        const egoOrder = readBits(bits, off + bitPos, 4)
        if (egoOrder > 0 && egoOrder <= sinnerEgos.length) {
          sinnerEgoMap[grade] = sinnerEgos[egoOrder - 1]
        }
      }
      if (Object.keys(sinnerEgoMap).length > 0) egoSlots[sinner.id] = sinnerEgoMap
    }

    formEntries.sort((a, b) => a.order - b.order)
    return { deckSlots, egoSlots, formationOrder: formEntries.map(e => e.sinnerId) }
  } catch {
    return null
  }
}

async function encodeDeckCode(
  sinners: Sinner[],
  identities: Identity[],
  egos: EGO[],
  deckSlots: Record<string, Identity | undefined>,
  egoSlots: Record<string, Record<string, EGO>>,
  formationOrder: string[],
): Promise<string> {
  const sorted = [...sinners].sort((a, b) => a.order_num - b.order_num)
  const arr = Array(560).fill('0')

  for (let si = 0; si < 12; si++) {
    const sinner = sorted[si]
    if (!sinner) continue
    const off = si * 46
    const sinnerIds = sortedIdentities(identities.filter(i => i.sinner_id === sinner.id))
    const sinnerEgos = egos.filter(e => e.sinner_id === sinner.id)
      .sort((a, b) => parseInt(a.game_id ?? '99999') - parseInt(b.game_id ?? '99999'))

    const identity = deckSlots[sinner.id]
    if (identity) {
      const order = sinnerIds.findIndex(i => i.id === identity.id) + 1
      if (order > 0) writeBitsArr(arr, off + CODE_BIT_POSITIONS.identity, 4, order)

      const formIdx = formationOrder.indexOf(sinner.id)
      if (formIdx !== -1) writeBitsArr(arr, off + CODE_BIT_POSITIONS.formation, 4, formIdx + 1)
    }

    const gradeMap: Record<string, number> = {
      ZAYIN: CODE_BIT_POSITIONS.ZAYIN,
      TETH:  CODE_BIT_POSITIONS.TETH,
      HE:    CODE_BIT_POSITIONS.HE,
      WAW:   CODE_BIT_POSITIONS.WAW,
    }
    for (const [grade, bitPos] of Object.entries(gradeMap)) {
      const ego = egoSlots[sinner.id]?.[grade]
      if (!ego) continue
      const order = sinnerEgos.findIndex(e => e.id === ego.id) + 1
      if (order > 0) writeBitsArr(arr, off + bitPos, 4, order)
    }
  }

  // bits → bytes → base64
  const bytes = new Uint8Array(70)
  for (let i = 0; i < 70; i++) bytes[i] = parseInt(arr.slice(i * 8, i * 8 + 8).join(''), 2)
  const b64 = btoa(String.fromCharCode(...bytes))

  // gzip compress
  const cs = new CompressionStream('gzip')
  const cw = cs.writable.getWriter()
  cw.write(new TextEncoder().encode(b64)); cw.close()
  const compBuf = await new Response(cs.readable).arrayBuffer()

  return btoa(String.fromCharCode(...new Uint8Array(compBuf)))
}

/* ── 메인 컴포넌트 ──────────────────────────────────── */
// 한국어 죄악명 → SinType
const SIN_KR_TO_TYPE: Record<string, SinType> = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth', '탐식': 'gluttony',
  '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

/* ── 패시브 뱃지 ─────────────────────────────────────── */
function PassiveBadge({ p, deckSinCounts }: {
  p: Passive
  deckSinCounts: Record<string, number>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null)

  // 복수 죄악 지원 (예: "나태, 오만")
  const sinNames = p.sin_affinity ? p.sin_affinity.split(',').map(s => s.trim()) : []
  const sinTypeList = sinNames.map(s => SIN_KR_TO_TYPE[s]).filter(Boolean) as SinType[]
  const sinType = sinTypeList[0] ?? null
  const sinColor = sinType ? SIN_COLORS[sinType] : '#667788'
  const currentCount = sinTypeList.reduce((sum, st) => sum + (deckSinCounts[st] ?? 0), 0)
  const requiredCount = p.sin_count ?? 1

  const handleMouseEnter = () => {
    if (!ref.current || !p.description) return
    const rect = ref.current.getBoundingClientRect()
    const above = rect.top > 160
    setTooltipStyle(
      above
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }
    )
  }

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-1.5 px-2 py-1 rounded"
      style={{ background: `${sinColor}12`, border: `1px solid ${sinColor}30`, flexShrink: 0, cursor: 'default' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipStyle(null)}
    >
      {/* 죄악 조건 */}
      {sinTypeList.length > 0 ? (
        <div className="flex items-center gap-0.5">
          {sinTypeList.map((st, i) => (
            <Image key={i} src={SIN_ICON_MAP[st]} alt="" width={16} height={16} unoptimized />
          ))}
          <span style={{ color: sinColor, fontSize: '0.625rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {currentCount}/{requiredCount}
          </span>
          <span style={{ color: sinColor, fontSize: '0.625rem', fontFamily: 'var(--font-mono)', marginLeft: '1px', opacity: 0.8 }}>
            {p.active_cond}
          </span>
        </div>
      ) : (
        <span style={{ color: '#445566', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>{p.active_cond ?? '-'}</span>
      )}
      <span style={{ color: sinColor, fontSize: '0.6875rem', fontWeight: 600 }}>{p.name}</span>

      {/* 호버 툴팁 — fixed로 overflow 탈출 */}
      {tooltipStyle && p.description && (
        <div
          className="z-[200] px-3 py-2.5 rounded shadow-lg pointer-events-none"
          style={{
            position: 'fixed',
            left: ref.current ? Math.min(ref.current.getBoundingClientRect().left, window.innerWidth - 330) : 0,
            ...tooltipStyle,
            background: '#1a1510',
            border: '1px solid #3a3020',
            minWidth: '220px',
            maxWidth: '320px',
            whiteSpace: 'normal',
          }}
        >
          <div style={{ color: sinColor, fontSize: '0.6875rem', fontWeight: 700, marginBottom: '4px' }}>{p.name}</div>
          <div style={{ color: '#999', fontSize: '0.6875rem', lineHeight: 1.5 }}>
            {formatSkillDesc(p.description, sinColor)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DeckBuilderClient({ sinners, identities, egos, skills, passives, egoGifts = [], editMode }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('identity')
  const [deckSlots, setDeckSlots] = useState<Record<string, Identity | undefined>>(() => {
    if (editMode?.identitySlotIds) {
      const slots: Record<string, Identity | undefined> = {}
      for (const [sinnerId, identityId] of Object.entries(editMode.identitySlotIds)) {
        slots[sinnerId] = identities.find(i => i.id === identityId)
      }
      return slots
    }
    return {}
  })
  // egoSlots: sinnerId → { grade → EGO } (등급별 1개), 기본값 = ZAYIN EGO
  const [egoSlots, setEgoSlots] = useState<Record<string, Record<string, EGO>>>(() => {
    if (editMode?.egoSlotIds) {
      const slots: Record<string, Record<string, EGO>> = {}
      for (const [sinnerId, gradeMap] of Object.entries(editMode.egoSlotIds)) {
        slots[sinnerId] = {}
        for (const [grade, egoId] of Object.entries(gradeMap)) {
          const ego = egos.find(e => e.id === egoId)
          if (ego) slots[sinnerId][grade] = ego
        }
      }
      return slots
    }
    const initial: Record<string, Record<string, EGO>> = {}
    for (const sinner of sinners) {
      // 이름 지정 기본값 우선, 없으면 ZAYIN EGO 사용
      const defaultName = DEFAULT_EGO_NAMES[sinner.name_kr]
      const ego = defaultName
        ? egos.find(e => e.sinner_id === sinner.id && (e.name_kr === defaultName || e.name === defaultName))
            ?? egos.find(e => e.sinner_id === sinner.id && e.grade === 'ZAYIN')
        : egos.find(e => e.sinner_id === sinner.id && e.grade === 'ZAYIN')
      if (ego) initial[sinner.id] = { [ego.grade]: ego }
    }
    return initial
  })
  const [formationOrder, setFormationOrder] = useState<string[]>(editMode?.formationOrder ?? [])
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const [modalGrade, setModalGrade] = useState<string | null>(null)
  const [title, setTitle] = useState(editMode?.title ?? '')
  const [contentType, setContentType] = useState<string>(editMode?.content_type && editMode.content_type !== '없음' ? editMode.content_type : '')
  const [description, setDescription] = useState(editMode?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [showCostDetail, setShowCostDetail] = useState(false)
  const [showIdentityDetail, setShowIdentityDetail] = useState(false)
  const [descPreview, setDescPreview] = useState(false)
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>(editMode?.gacksungSlots ?? {})
  const [skillDistribution, setSkillDistribution] = useState<Record<string, [number, number, number]>>(editMode?.skillDistribution ?? {})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeApplying, setCodeApplying] = useState(false)
  const [codeError, setCodeError] = useState(false)
  const { status: authStatus } = useSession()
  const [draftSaved, setDraftSaved] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  useEffect(() => {
    setHasDraft(!!localStorage.getItem('limbus-deck-draft'))
  }, [])


  const skillsByIdentityId = useMemo(() => {
    const map: Record<string, Skill[]> = {}
    for (const s of skills) {
      if (!map[s.identity_id]) map[s.identity_id] = []
      map[s.identity_id].push(s)
    }
    return map
  }, [skills])

  const passivesByIdentityId = useMemo(() => {
    const map: Record<string, Passive[]> = {}
    for (const p of passives) {
      if (!map[p.identity_id]) map[p.identity_id] = []
      map[p.identity_id].push(p)
    }
    return map
  }, [passives])

  const [showPassiveDetail, setShowPassiveDetail] = useState(false)
  const [showGiftPanel, setShowGiftPanel] = useState(false)
  const [giftTabKw, setGiftTabKw] = useState('전체')

  const atkTypeTotals = useMemo(() => {
    const totals: Record<string, number> = { slash: 0, pierce: 0, blunt: 0 }
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      for (const sk of skillsByIdentityId[identity.id] ?? []) {
        if (sk.skill_type in totals) totals[sk.skill_type]++
      }
    }
    return totals
  }, [deckSlots, skillsByIdentityId])

  const sinCostTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]
    for (const sinnerSlots of Object.values(egoSlots)) {
      for (const ego of Object.values(sinnerSlots)) {
        if (ego.cost) {
          for (let i = 0; i < 7; i++) totals[i] += ego.cost[i] ?? 0
        }
      }
    }
    return totals
  }, [egoSlots])

  const skillTokenLookup = useMemo(() => {
    const map: Record<string, NoteSkillEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      const idSkills = skillsByIdentityId[identity.id] ?? []
      const imgIdx = computeSkillImageIndices(idSkills)
      const orderCount: Record<number, number> = {}
      for (const sk of idSkills) {
        const subIdx = orderCount[sk.skill_order] || 0
        orderCount[sk.skill_order] = subIdx + 1
        const key = subIdx === 0
          ? `${sinnerName}:${sk.skill_order}`
          : `${sinnerName}:${sk.skill_order}:${subIdx}`
        map[key] = {
          name: sk.name, skill_type: sk.skill_type, sin_affinity: sk.sin_affinity as string,
          skill_order: sk.skill_order, description: sk.description,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order),
          identityName: identity.name_kr, sinnerName,
        }
      }
    }
    return map
  }, [deckSlots, skillsByIdentityId, sinners])

  const passiveTokenLookup = useMemo(() => {
    const map: Record<string, NotePassiveEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const p of passivesByIdentityId[identity.id] ?? []) {
        map[p.name] = {
          name: p.name, sin_affinity: p.sin_affinity,
          sin_count: p.sin_count, active_cond: p.active_cond,
          description: p.description, sinnerName,
        }
      }
    }
    return map
  }, [deckSlots, passivesByIdentityId, sinners])

  const egoTokenLookup = useMemo(() => {
    const map: Record<string, NoteEgoEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const ego of Object.values(egoSlots[identity.sinner_id] ?? {})) {
        const name = ego.name_kr || ego.name
        map[`${sinnerName}:${name}`] = {
          name, grade: ego.grade, sin_affinity: ego.sin_affinity,
          image_url: ego.image_url, sinnerName,
        }
      }
    }
    return map
  }, [deckSlots, egoSlots, sinners])

  // 활성 가능한 EGO 기프트 계산
  const activatableGifts = useMemo(() => {
    // 편성 순서에 포함된 인격만 계산
    const formedIdentities = formationOrder
      .map(sid => deckSlots[sid])
      .filter(Boolean) as Identity[]
    if (formedIdentities.length === 0) return []

    // 키워드별 인격 수 (화상, 출혈 등)
    const kwCounts: Record<string, number> = {}
    // 소속별 인격 수 (검계, 흑운회 등)
    const affCounts: Record<string, number> = {}

    for (const id of formedIdentities) {
      if (id.keywords) {
        for (const kw of id.keywords) {
          kwCounts[kw] = (kwCounts[kw] ?? 0) + 1
        }
      }
      if (id.affiliation) {
        affCounts[id.affiliation] = (affCounts[id.affiliation] ?? 0) + 1
      }
    }

    type GiftStatus = {
      name: string; keyword: string; grade: string; image_url: string | null
      effect_base: string | null; condition: ActivationCondition
      current: number; met: boolean
    }

    const results: GiftStatus[] = []
    for (const g of egoGifts) {
      const c = g.activation_condition
      if (!c) continue

      let current = 0
      if (c.type === 'keyword') {
        current = kwCounts[c.keyword!] ?? 0
      } else if (c.type === 'multi_keyword') {
        for (const kw of c.keywords!) current += kwCounts[kw] ?? 0
      } else if (c.type === 'affiliation') {
        if (c.affiliations) {
          for (const aff of c.affiliations) current += affCounts[aff] ?? 0
        } else {
          current = affCounts[c.affiliation!] ?? 0
        }
      } else if (c.type === 'skill') {
        continue // 스킬 조건은 키워드/소속으로 판별 불가
      }

      if (current > 0) {
        results.push({
          name: g.name, keyword: g.keyword, grade: g.grade,
          image_url: g.image_url, effect_base: g.effect_base,
          condition: c, current, met: current >= c.count,
        })
      }
    }

    // 활성 우선, 그 안에서 달성률 내림차순
    results.sort((a, b) => {
      if (a.met !== b.met) return a.met ? -1 : 1
      return (b.current / b.condition.count) - (a.current / a.condition.count)
    })
    return results
  }, [deckSlots, egoGifts, formationOrder])

  // EGO 기프트 룩업 (NoteRenderer용)
  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of egoGifts) {
      map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade, image_url: g.image_url, effect_base: g.effect_base }
    }
    return map
  }, [egoGifts])

  // 자동완성 풀 (키워드 + 스킬 + 패시브 + 에고)
  const noteAcPool = useMemo((): AutocompleteSuggestion[] => {
    const pool: AutocompleteSuggestion[] = []
    // 스킬
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      const idSkills = skillsByIdentityId[identity.id] ?? []
      const imgIdx = computeSkillImageIndices(idSkills)
      const acOrderCount: Record<number, number> = {}
      for (const sk of idSkills) {
        const subIdx = acOrderCount[sk.skill_order] || 0
        acOrderCount[sk.skill_order] = subIdx + 1
        const sc = SIN_COLORS[sk.sin_affinity] || '#888'
        const orderLabel = subIdx === 0 ? `S${sk.skill_order}` : `S${sk.skill_order}-${subIdx + 1}`
        const token = subIdx === 0
          ? `[s:${sinnerName}:${sk.skill_order}]`
          : `[s:${sinnerName}:${sk.skill_order}:${subIdx}]`
        pool.push({
          label: `${orderLabel} ${sk.name}`, type: 'skill', typeLabel: '스킬', color: sc,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order),
          token,
        })
      }
    }
    // 패시브
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      for (const p of passivesByIdentityId[identity.id] ?? []) {
        const sinEn = p.sin_affinity ? (SIN_COLORS as Record<string, string>)[p.sin_affinity] : undefined
        pool.push({
          label: p.name, type: 'passive', typeLabel: '패시브', color: sinEn || '#88a830',
          token: `[p:${p.name}]`,
        })
      }
    }
    // 에고
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const ego of Object.values(egoSlots[identity.sinner_id] ?? {})) {
        const name = ego.name_kr || ego.name
        const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity] ?? '#c8900a') : '#c8900a'
        pool.push({
          label: name, type: 'ego', typeLabel: 'E.G.O', color: sc,
          imageUrl: ego.image_url ?? undefined,
          token: `[e:${sinnerName}:${name}]`,
        })
      }
    }
    // 키워드
    pool.push(...buildKeywordPool())
    // EGO 기프트
    pool.push(...buildEgoGiftPool(egoGifts))
    return pool
  }, [deckSlots, skillsByIdentityId, passivesByIdentityId, egoSlots, sinners, egoGifts])

  const noteAc = useNoteAutocomplete({
    text: description,
    setText: setDescription,
    textareaRef,
    pool: noteAcPool,
  })

  const identityCount = Object.values(deckSlots).filter(Boolean).length
  const egoCount = Object.values(egoSlots).reduce((s, g) => s + Object.keys(g).length, 0)
  const skillsetCustomCount = useMemo(() => {
    return Object.entries(skillDistribution).filter(([sinnerId, dist]) => {
      if (!deckSlots[sinnerId]) return false
      return !(dist[0] === 3 && dist[1] === 2 && dist[2] === 1)
    }).length
  }, [skillDistribution, deckSlots])

  const modalSinner = sinners.find(s => s.id === modalSinnerId)
  const modalIdentities = modalSinnerId ? identities.filter(i => i.sinner_id === modalSinnerId) : []
  const modalEgos = modalSinnerId ? egos.filter(e => e.sinner_id === modalSinnerId) : []

  const handleIdentitySelect = (identity: Identity) => {
    if (!modalSinnerId) return
    setDeckSlots(prev => {
      if (prev[modalSinnerId]?.id === identity.id) {
        const next = { ...prev }; delete next[modalSinnerId]; return next
      }
      return { ...prev, [modalSinnerId]: identity }
    })
    setModalSinnerId(null)
  }

  const handleGradeClick = (sinnerId: string, grade: string) => {
    setModalSinnerId(sinnerId)
    setModalGrade(grade)
  }

  const closeEgoModal = () => {
    setModalSinnerId(null)
    setModalGrade(null)
  }

  const handleEgoSelect = (ego: EGO) => {
    if (!modalSinnerId) return
    setEgoSlots(prev => {
      const sinnerSlots: Record<string, EGO> = prev[modalSinnerId] ?? {}
      if (sinnerSlots[ego.grade]?.id === ego.id) {
        const next = { ...sinnerSlots }
        delete next[ego.grade]
        return { ...prev, [modalSinnerId]: next } as Record<string, Record<string, EGO>>
      }
      return { ...prev, [modalSinnerId]: { ...sinnerSlots, [ego.grade]: ego } } as Record<string, Record<string, EGO>>
    })
    closeEgoModal()
  }

  const handleGacksungToggle = (sinnerId: string) => {
    setGacksungSlots(prev => ({ ...prev, [sinnerId]: !(prev[sinnerId] ?? false) }))
  }

  const handleFormationToggle = (sinnerId: string) => {
    setFormationOrder(prev => {
      if (prev.includes(sinnerId)) return prev.filter(id => id !== sinnerId)
      if (prev.length >= 12) return prev
      return [...prev, sinnerId]
    })
  }

  const handleSave = async () => {
    if (!title.trim() || identityCount < 12 || !contentType) return
    setSaving(true)
    const identitySlots = sinners
      .filter(s => deckSlots[s.id])
      .map(s => {
        const dist = skillDistribution[s.id] ?? [3, 2, 1]
        return {
          identity_id: deckSlots[s.id]!.id,
          gacksung: gacksungSlots[s.id] ?? false,
          slot_order: formationOrder.indexOf(s.id) >= 0 ? formationOrder.indexOf(s.id) : 99,
          s1_count: dist[0],
          s2_count: dist[1],
          s3_count: dist[2],
        }
      })
    const egoRows = Object.entries(egoSlots).flatMap(([, gradeMap]) =>
      Object.entries(gradeMap).map(([grade, ego]) => ({ ego_id: ego.id, grade }))
    )
    const url = editMode ? `/api/decks/${editMode.deckId}` : '/api/decks'
    const method = editMode ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, tags: [], content_type: contentType, identitySlots, egoSlots: egoRows }),
    })
    setSaving(false)
    if (res.ok) router.push(editMode ? `/decks/${editMode.deckId}` : '/decks')
  }

  const handleSaveDraft = () => {
    const draft = {
      title,
      contentType,
      description,
      deckSlotIds: Object.fromEntries(
        Object.entries(deckSlots).filter(([, v]) => v).map(([k, v]) => [k, v!.id])
      ),
      egoSlotIds: Object.fromEntries(
        Object.entries(egoSlots).map(([k, v]) => [
          k,
          Object.fromEntries(Object.entries(v).map(([grade, ego]) => [grade, ego.id])),
        ])
      ),
      formationOrder,
      savedAt: Date.now(),
    }
    Object.assign(draft, { gacksungSlots, skillDistribution })
    localStorage.setItem('limbus-deck-draft', JSON.stringify(draft))
    setHasDraft(true)
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }

  const handleLoadDraft = () => {
    try {
      const raw = localStorage.getItem('limbus-deck-draft')
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.title) setTitle(draft.title)
      if (draft.contentType) setContentType(draft.contentType)
      if (draft.description) setDescription(draft.description)
      if (draft.formationOrder) setFormationOrder(draft.formationOrder)
      if (draft.deckSlotIds) {
        const slots: Record<string, Identity | undefined> = {}
        for (const [sinnerId, identityId] of Object.entries(draft.deckSlotIds)) {
          slots[sinnerId] = identities.find(i => i.id === identityId)
        }
        setDeckSlots(slots)
      }
      if (draft.egoSlotIds) {
        const slots: Record<string, Record<string, EGO>> = {}
        for (const [sinnerId, gradeMap] of Object.entries(draft.egoSlotIds as Record<string, Record<string, string>>)) {
          slots[sinnerId] = {}
          for (const [grade, egoId] of Object.entries(gradeMap)) {
            const ego = egos.find(e => e.id === egoId)
            if (ego) slots[sinnerId][grade] = ego
          }
        }
        setEgoSlots(slots)
      }
      if (draft.gacksungSlots) setGacksungSlots(draft.gacksungSlots)
      if (draft.skillDistribution) setSkillDistribution(draft.skillDistribution)
      setHasDraft(false)
      localStorage.removeItem('limbus-deck-draft')
    } catch { /* ignore */ }
  }

  const handleApplyCode = async () => {
    if (!codeInput.trim()) return
    setCodeApplying(true)
    setCodeError(false)
    const result = await decodeDeckCode(codeInput.trim(), sinners, identities, egos)
    setCodeApplying(false)
    if (!result) { setCodeError(true); return }
    setDeckSlots(result.deckSlots)
    setEgoSlots(result.egoSlots)
    setFormationOrder(result.formationOrder)
    setCodeInput('')
    setTab('identity')
  }

  const handleCopyCode = async () => {
    const code = await encodeDeckCode(sinners, identities, egos, deckSlots, egoSlots, formationOrder)
    await navigator.clipboard.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: '#e8e4d8' } as const

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'identity', label: '인격 편성', badge: identityCount || undefined },
    { key: 'ego',      label: '에고 편성', badge: egoCount || undefined },
    { key: 'skillset', label: '스킬 편성', badge: skillsetCustomCount || undefined },
    { key: 'order',    label: '편성 순서', badge: formationOrder.length || undefined },
    { key: 'note',     label: '덱 노트' },
  ]

  return (
    <div className="min-h-screen pt-20 pb-16">
      {/* 헤더 */}
      <div className="px-6 max-w-5xl mx-auto mb-5 flex flex-wrap items-center gap-3 sm:gap-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <Link href="/decks" className="text-sm transition-colors hover:text-yellow-300" style={{ color: '#555566' }}>← 뒤로</Link>
        <h1 className="font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>{editMode ? '덱 수정' : '덱 편성'}</h1>
        <div className="flex-1 hidden sm:block" />
        <input
          type="text"
          placeholder="덱 제목 *"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="px-3 py-1.5 rounded text-sm outline-none w-full sm:w-auto"
          style={{ ...inputStyle, maxWidth: '260px' }}
          onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <div className="flex gap-1.5 flex-wrap">
          {CONTENT_TYPES.map(ct => {
            const active = contentType === ct
            const colors = CONTENT_TYPE_BTN_COLORS[ct]
            return (
              <button
                key={ct}
                type="button"
                onClick={() => setContentType(active ? '' : ct)}
                className="px-2.5 py-1 rounded text-xs transition-all duration-150"
                style={{
                  background: active ? colors.bg : 'transparent',
                  color: active ? colors.color : '#555566',
                  border: `1px solid ${active ? colors.border : 'var(--border)'}`,
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.6875rem',
                }}
              >
                {ct}
              </button>
            )
          })}
        </div>
        {hasDraft && (
          <button
            onClick={handleLoadDraft}
            className="px-3 py-1.5 rounded text-sm transition-all"
            style={{ color: '#88aacc', border: '1px solid rgba(136,170,204,0.3)', background: 'rgba(136,170,204,0.08)' }}
          >
            초안 불러오기
          </button>
        )}
        <button
          onClick={handleSaveDraft}
          disabled={!title.trim()}
          className="px-5 py-1.5 rounded font-medium text-sm transition-all duration-200 disabled:opacity-40"
          style={{ background: draftSaved ? 'rgba(136,204,136,0.2)' : 'rgba(200,144,10,0.15)', color: draftSaved ? '#88cc88' : 'var(--gold)', border: `1px solid ${draftSaved ? '#88cc8855' : 'rgba(200,144,10,0.4)'}` }}
        >
          {draftSaved ? '✓ 임시 저장됨' : '임시 저장'}
        </button>
        {authStatus === 'authenticated' && (
          <button
            onClick={handleSave}
            disabled={!title.trim() || identityCount < 12 || !contentType || saving}
            title={!contentType ? '콘텐츠 유형을 선택해주세요' : identityCount < 12 ? `12명 전원 인격을 편성해야 합니다 (${identityCount}/12)` : ''}
            className="px-5 py-1.5 rounded font-medium text-sm transition-all duration-200 disabled:opacity-40 hover:brightness-110"
            style={{ background: 'var(--gold)', color: 'var(--bg-deep)' }}
          >
            {saving ? '저장 중...' : editMode ? '저장' : '업로드'}
          </button>
        )}
      </div>

      <div className="px-4 sm:px-6 max-w-5xl mx-auto">
        {/* 편성 코드 바 */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
          <input
            type="text"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value); setCodeError(false) }}
            placeholder="편성 코드 붙여넣기..."
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded outline-none flex-1"
            style={{ ...inputStyle, minWidth: '120px', maxWidth: '420px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
            onKeyDown={e => { if (e.key === 'Enter') handleApplyCode() }}
          />
          <button
            onClick={handleApplyCode}
            disabled={!codeInput.trim() || codeApplying}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded text-xs sm:text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: 'rgba(200,144,10,0.15)', color: 'var(--gold)', border: '1px solid rgba(200,144,10,0.3)' }}
          >
            {codeApplying ? '...' : '적용'}
          </button>
          {codeError && (
            <span style={{ color: '#cc4444', fontSize: '0.75rem' }}>오류</span>
          )}
          <button
            onClick={handleCopyCode}
            disabled={identityCount < 12}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded text-xs sm:text-sm transition-all disabled:opacity-30 ml-auto"
            style={{
              color: codeCopied ? '#88cc88' : '#6a6a80',
              border: `1px solid ${codeCopied ? '#88cc8855' : 'var(--border)'}`,
              background: codeCopied ? 'rgba(136,204,136,0.08)' : 'transparent',
            }}
            title={identityCount < 12 ? '12명 전원 인격을 편성해야 코드를 복사할 수 있습니다' : ''}
          >
            {codeCopied ? '✓ 복사됨' : '코드 복사'}
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex gap-0 mb-7 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {TABS.map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="relative px-3 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0"
              style={{
                color: tab === key ? 'var(--gold)' : '#555566',
                borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom: '-1px',
                background: 'transparent',
              }}
            >
              {label}
              {badge !== undefined && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '10px',
                    background: tab === key ? 'var(--gold)' : '#333322',
                    color: tab === key ? 'var(--bg-deep)' : '#888866',
                    fontSize: '0.5625rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    borderRadius: '10px',
                    padding: '1px 5px',
                    lineHeight: 1.4,
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {tab === 'identity' && (
          <IdentityTab
            sinners={sinners}
            deckSlots={deckSlots}
            onCardClick={setModalSinnerId}
            gacksungSlots={gacksungSlots}
            onGacksungToggle={handleGacksungToggle}
          />
        )}
        {tab === 'ego' && (
          <EgoTab
            sinners={sinners}
            egoSlots={egoSlots}
            onGradeClick={handleGradeClick}
          />
        )}
        {tab === 'skillset' && (
          <SkillsetTab
            sinners={sinners}
            deckSlots={deckSlots}
            skillsByIdentityId={skillsByIdentityId}
            skillDistribution={skillDistribution}
            onDistributionChange={(sinnerId, dist) =>
              setSkillDistribution(prev => ({ ...prev, [sinnerId]: dist }))
            }
          />
        )}
        {tab === 'order' && (
          <OrderTab
            sinners={sinners}
            deckSlots={deckSlots}
            formationOrder={formationOrder}
            onToggle={handleFormationToggle}
          />
        )}

        {/* ── 정보 패널 (note 탭 제외) ──────────────────────── */}
        {tab !== 'note' && (<>
        {/* ── 죄악 자원 패널 ──────────────────────────────── */}
        <div className="mt-8" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          {/* 요약 바 */}
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
            <span style={{ color: '#6a6a80', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>죄악 자원</span>
            <div className="flex items-center gap-4 flex-1 flex-wrap">
              {SIN_ORDER.map((sin, i) => {
                const total = sinCostTotals[i]
                if (total === 0) return null
                return (
                  <div key={sin} className="flex items-center gap-1">
                    <Image src={SIN_ICON_MAP[sin]} alt={SIN_LABELS_KR[sin]} width={18} height={18} unoptimized />
                    <span style={{ color: SIN_COLORS[sin], fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{total}</span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setShowCostDetail(v => !v)}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{ color: showCostDetail ? 'var(--gold)' : '#6a6a80', border: `1px solid ${showCostDetail ? 'var(--gold)' : 'var(--border)'}`, background: showCostDetail ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
            >
              상세보기 {showCostDetail ? '▲' : '▼'}
            </button>
          </div>

          {/* 상세 보기 — 각 EGO 한 줄씩 */}
          {showCostDetail && (
            <div style={{ background: 'rgba(5,4,2,0.7)', borderTop: '1px solid var(--border)' }}>
              {sinners.flatMap(sinner => {
                const sinnerSlots = egoSlots[sinner.id] ?? {}
                return Object.values(sinnerSlots).map((ego, idx) => {
                  const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? '#667788') : '#667788'
                  const gc = GRADE_COLORS[ego.grade] ?? '#667788'
                  const atkType = ego.ego_skills?.[0]?.atkType ?? null
                  return (
                    <div
                      key={ego.id}
                      className="flex items-center gap-4 px-4 py-2"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                    >
                      {/* 일러스트 */}
                      <div style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: '#0d0a06', border: `1px solid ${sc}40` }}>
                        {ego.image_url
                          ? <Image src={ego.image_url} alt="" fill unoptimized className="object-cover" style={{ objectPosition: '50% 10%' }} />
                          : <div className="w-full h-full flex items-center justify-center"><span style={{ color: gc, fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>{ego.grade?.[0]}</span></div>
                        }
                      </div>

                      {/* 등급 아이콘 */}
                      <div style={{ flexShrink: 0, width: '28px' }}>
                        {ego.grade !== 'ALEPH' ? (
                          <Image src={`${STORAGE_BASE}/icons/grade/${ego.grade}.webp`} alt={ego.grade} width={28} height={14} unoptimized style={{ height: '14px', width: 'auto' }} />
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.4375rem', color: gc, letterSpacing: '0.08em' }}>ALEPH</span>
                        )}
                      </div>

                      {/* 수감자 + EGO명 */}
                      <div style={{ minWidth: '140px', flexShrink: 0 }}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={10} height={10} unoptimized style={{ opacity: 0.4 }} />
                          <span style={{ color: '#6a5e38', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>{sinner.name_kr}</span>
                        </div>
                        <p style={{ color: sc, fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>{ego.name_kr || ego.name}</p>
                      </div>

                      {/* 공격 유형 */}
                      <div style={{ flexShrink: 0, width: '24px' }}>
                        {atkType && ATK_TYPE_ICON_MAP[atkType] && (
                          <Image src={ATK_TYPE_ICON_MAP[atkType]} alt={atkType} title={atkType} width={18} height={18} unoptimized style={{ opacity: 0.85 }} />
                        )}
                      </div>

                      {/* 죄악 비용 — 7칸 고정 */}
                      <div className="flex items-center gap-3 flex-1">
                        {SIN_ORDER.map((sin, i) => {
                          const cost = ego.cost?.[i] ?? 0
                          return (
                            <div key={sin} className="flex items-center gap-0.5" style={{ opacity: cost === 0 ? 0.15 : 1, minWidth: '28px' }}>
                              <Image src={SIN_ICON_MAP[sin]} alt="" width={14} height={14} unoptimized />
                              <span style={{ color: SIN_COLORS[sin], fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{cost}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })}
            </div>
          )}
        </div>

        {/* ── 인격 스킬 유형 패널 ──────────────────────────── */}
        <div className="mt-4" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
            <span style={{ color: '#6a6a80', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>공격 유형</span>
            <div className="flex items-center gap-4 flex-1">
              {(['slash', 'pierce', 'blunt'] as const).map(type => {
                const count = atkTypeTotals[type]
                if (count === 0) return null
                return (
                  <div key={type} className="flex items-center gap-1">
                    <Image src={ATK_TYPE_ICON_MAP[type]} alt={type} width={16} height={16} unoptimized />
                    <span style={{ color: '#aaaaaa', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setShowIdentityDetail(v => !v)}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{ color: showIdentityDetail ? 'var(--gold)' : '#6a6a80', border: `1px solid ${showIdentityDetail ? 'var(--gold)' : 'var(--border)'}`, background: showIdentityDetail ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
            >
              상세보기 {showIdentityDetail ? '▲' : '▼'}
            </button>
          </div>

          {showIdentityDetail && (
            <div style={{ background: 'rgba(5,4,2,0.7)', borderTop: '1px solid var(--border)' }}>
              {sinners.map((sinner, idx) => {
                const identity = deckSlots[sinner.id]
                if (!identity) return null
                const idSkills = skillsByIdentityId[identity.id] ?? []
                const idSkillImgIdx = computeSkillImageIndices(idSkills)
                return (
                  <div
                    key={sinner.id}
                    className="flex items-center gap-4 px-4 py-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  >
                    {/* 일러스트 */}
                    <div style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: '#0d0a06' }}>
                      {getIdentityInfoUrl(identity) ? (
                        <Image src={getIdentityInfoUrl(identity)} alt="" fill unoptimized className="object-cover object-top" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span style={{ color: '#6a5e38', fontSize: '0.875rem' }}>{identity.name_kr?.[0]}</span>
                        </div>
                      )}
                    </div>

                    {/* 수감자 + 인격명 */}
                    <div style={{ minWidth: '150px', flexShrink: 0 }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} unoptimized style={{ opacity: 0.4 }} />
                        <span style={{ color: '#6a5e38', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{sinner.name_kr}</span>
                      </div>
                      <p style={{ color: '#c8a450', fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>{identity.name_kr || identity.name}</p>
                    </div>

                    {/* 스킬 공격 유형 (S1/S2/S3만) */}
                    <div className="flex items-center gap-2 flex-1">
                      {idSkills.filter(s => s.skill_order >= 1 && s.skill_order <= 3).filter((s, idx, arr) => arr.findIndex(x => x.skill_order === s.skill_order) === idx).map((sk) => {
                        const label = String(sk.skill_order)
                        const iconUrl = getSkillIconUrl(identity, idSkillImgIdx[sk.id] ?? sk.skill_order)
                        const atkIcon = ATK_TYPE_ICON_MAP[sk.skill_type]
                        return (
                          <div key={sk.id} className="flex flex-col items-center gap-0.5" style={{ minWidth: '30px' }}>
                            {/* 스킬 아이콘 */}
                            <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                              {iconUrl ? (
                                <Image src={iconUrl} alt={label} width={24} height={24} unoptimized style={{ borderRadius: '50%' }} />
                              ) : (
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1a1510' }} />
                              )}
                              {/* 공격 유형 아이콘 오버레이 */}
                              {atkIcon && (
                                <Image src={atkIcon} alt="" width={11} height={11} unoptimized style={{ position: 'absolute', bottom: '-2px', right: '-2px' }} />
                              )}
                            </div>
                            <span style={{ color: '#6a6a80', fontSize: '0.5rem', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{label}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* 내성 — 참격/관통/타격 */}
                    <div className="flex items-center gap-4 flex-1">
                      {(['slash_res', 'pierce_res', 'blunt_res'] as const).map(resKey => {
                        const atkSlug = resKey === 'slash_res' ? 'slash' : resKey === 'pierce_res' ? 'pierce' : 'blunt'
                        const val = identity[resKey] ?? '-'
                        const col = RES_COLORS[val] ?? '#555566'
                        return (
                          <div key={resKey} className="flex items-center gap-1">
                            <Image src={ATK_TYPE_ICON_MAP[atkSlug]} alt={atkSlug} width={16} height={16} unoptimized style={{ opacity: 0.6 }} />
                            <span style={{ color: col, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {Object.values(deckSlots).filter(Boolean).length === 0 && (
                <p className="text-center py-4" style={{ color: '#555570', fontSize: '0.6875rem' }}>인격을 먼저 편성해주세요</p>
              )}
            </div>
          )}
        </div>

        {/* ── 패시브 패널 ──────────────────────────────────── */}
        <div className="mt-4" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
            <span style={{ color: '#6a6a80', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>패시브</span>
            <div className="flex-1" />
            <button
              onClick={() => setShowPassiveDetail(v => !v)}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{ color: showPassiveDetail ? 'var(--gold)' : '#6a6a80', border: `1px solid ${showPassiveDetail ? 'var(--gold)' : 'var(--border)'}`, background: showPassiveDetail ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
            >
              상세보기 {showPassiveDetail ? '▲' : '▼'}
            </button>
          </div>

          {showPassiveDetail && (() => {
            // 덱 전체 스킬 죄악 합산
            const deckSinCounts: Record<string, number> = {}
            for (const sinner of sinners) {
              const id = deckSlots[sinner.id]
              if (!id) continue
              for (const sk of skillsByIdentityId[id.id] ?? []) {
                if (sk.sin_affinity) deckSinCounts[sk.sin_affinity] = (deckSinCounts[sk.sin_affinity] ?? 0) + 1
              }
            }
            return (
            <div style={{ background: 'rgba(5,4,2,0.7)', borderTop: '1px solid var(--border)' }}>
              {sinners.map((sinner, idx) => {
                const identity = deckSlots[sinner.id]
                if (!identity) return null
                const allPassives = passivesByIdentityId[identity.id] ?? []
                const battlePassives = allPassives.filter(p => p.passive_type === 'battle' && p.sin_affinity)
                const supportPassives = allPassives.filter(p => p.passive_type === 'support' && p.sin_affinity)

                return (
                  <div
                    key={sinner.id}
                    className="flex items-start gap-4 px-4 py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  >
                    {/* 수감자 + 인격명 */}
                    <div style={{ minWidth: '150px', flexShrink: 0 }}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} unoptimized style={{ opacity: 0.4 }} />
                        <span style={{ color: '#6a5e38', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{sinner.name_kr}</span>
                      </div>
                      <p style={{ color: '#c8a450', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.2 }}>{identity.name_kr || identity.name}</p>
                    </div>

                    {/* 배틀 패시브 */}
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#555570', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', marginBottom: '4px', letterSpacing: '0.05em' }}>일반 패시브</p>
                      <div className="flex flex-col gap-1.5">
                        {battlePassives.length > 0
                          ? battlePassives.map(p => <PassiveBadge key={p.id} p={p} deckSinCounts={deckSinCounts} />)
                          : <span style={{ color: '#5a5260', fontSize: '0.5625rem' }}>-</span>
                        }
                      </div>
                    </div>

                    {/* 구분선 */}
                    <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />

                    {/* 서포트 패시브 */}
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#555570', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', marginBottom: '4px', letterSpacing: '0.05em' }}>서포트 패시브</p>
                      <div className="flex flex-col gap-1.5">
                        {supportPassives.length > 0
                          ? supportPassives.map(p => <PassiveBadge key={p.id} p={p} deckSinCounts={deckSinCounts} />)
                          : <span style={{ color: '#5a5260', fontSize: '0.5625rem' }}>-</span>
                        }
                      </div>
                    </div>
                  </div>
                )
              })}
              {Object.values(deckSlots).filter(Boolean).length === 0 && (
                <p className="text-center py-4" style={{ color: '#555570', fontSize: '0.6875rem' }}>인격을 먼저 편성해주세요</p>
              )}
            </div>
            )
          })()}
        </div>

        {/* ── 활성 가능 EGO 기프트 패널 (거던 유형만) ─────────────────────── */}
        {['거던5층', '거던10층', '거던15층'].includes(contentType) && (
        <div className="mt-4" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
            <span style={{ color: '#6a6a80', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>E.G.O 기프트</span>
            {activatableGifts.length > 0 && (
              <span style={{ color: '#555570', fontSize: '0.5625rem' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{activatableGifts.filter(g => g.met).length}</span>
                <span> 활성</span>
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setShowGiftPanel(v => !v)}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{ color: showGiftPanel ? 'var(--gold)' : '#6a6a80', border: `1px solid ${showGiftPanel ? 'var(--gold)' : 'var(--border)'}`, background: showGiftPanel ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
            >
              상세보기 {showGiftPanel ? '▲' : '▼'}
            </button>
          </div>

          {showGiftPanel && (() => {
            const GIFT_KW_TABS = ['전체', '화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격', '공통'] as const
            const filtered = giftTabKw === '전체'
              ? activatableGifts
              : activatableGifts.filter(g => g.keyword === giftTabKw)
            // 탭별 활성 개수
            const metByKw: Record<string, number> = {}
            for (const g of activatableGifts) {
              if (g.met) metByKw[g.keyword] = (metByKw[g.keyword] ?? 0) + 1
            }

            return (
            <div style={{ background: 'rgba(5,4,2,0.7)', borderTop: '1px solid var(--border)' }}>
              {/* 키워드 탭 */}
              <div className="flex flex-wrap gap-1 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {GIFT_KW_TABS.map(kw => {
                  const isActive = giftTabKw === kw
                  const kwIcon = kw !== '전체' ? (getKeywordIconUrl(kw) ?? ATK_TYPE_ICON_MAP[kw] ?? null) : null
                  const metCount = kw === '전체' ? activatableGifts.filter(g => g.met).length : (metByKw[kw] ?? 0)
                  const totalCount = kw === '전체' ? activatableGifts.length : activatableGifts.filter(g => g.keyword === kw).length
                  if (kw !== '전체' && totalCount === 0) return null
                  return (
                    <button
                      key={kw}
                      onClick={() => setGiftTabKw(kw)}
                      className="flex items-center gap-1 px-2 py-1 rounded transition-all"
                      style={{
                        fontSize: '0.625rem', fontWeight: isActive ? 700 : 400,
                        color: isActive ? 'var(--gold)' : '#555',
                        background: isActive ? 'rgba(200,144,10,0.1)' : 'transparent',
                        border: `1px solid ${isActive ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.04)'}`,
                      }}
                    >
                      {kwIcon && (
                        <Image src={kwIcon} alt="" width={11} height={11} unoptimized />
                      )}
                      {kw}
                      {metCount > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.5625rem' }}>{metCount}</span>}
                    </button>
                  )
                })}
              </div>

              {/* 기프트 목록 */}
              <div style={{ padding: '6px 8px', maxHeight: '320px', overflowY: 'auto' }}>
                {Object.values(deckSlots).filter(Boolean).length === 0 ? (
                  <p className="text-center py-4" style={{ color: '#555570', fontSize: '0.6875rem' }}>인격을 먼저 편성해주세요</p>
                ) : filtered.length === 0 ? (
                  <p className="text-center py-3" style={{ color: '#555570', fontSize: '0.6875rem' }}>해당하는 기프트가 없습니다</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filtered.map(g => {
                      const c = g.condition
                      const condLabel = c.type === 'keyword' ? `${c.keyword} ${c.count}인`
                        : c.type === 'multi_keyword' ? `${c.keywords!.join('+')} ${c.count}인`
                        : c.type === 'affiliation' ? `${c.affiliation ?? c.affiliations!.join('/')} ${c.count}인`
                        : `${c.count}인`
                      const pct = Math.min(g.current / c.count, 1)
                      const kwIcon = getKeywordIconUrl(g.keyword) ?? ATK_TYPE_ICON_MAP[g.keyword] ?? null

                      return (
                        <div
                          key={g.name}
                          className="flex items-center gap-2.5 px-3 py-2 rounded"
                          style={{
                            background: g.met ? 'rgba(200,144,10,0.06)' : 'rgba(255,255,255,0.01)',
                            border: `1px solid ${g.met ? 'rgba(200,144,10,0.2)' : 'rgba(255,255,255,0.03)'}`,
                            opacity: g.met ? 1 : 0.6,
                          }}
                        >
                          {g.image_url ? (
                            <Image src={g.image_url} alt="" width={28} height={28} unoptimized style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: g.met ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)' }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1510', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: g.met ? 'var(--gold)' : '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                              <span style={{ fontSize: '0.5625rem', color: '#444', flexShrink: 0 }}>{g.grade}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {kwIcon && (
                                <Image src={kwIcon} alt="" width={10} height={10} unoptimized style={{ flexShrink: 0 }} />
                              )}
                              <span style={{ fontSize: '0.5625rem', color: g.met ? '#88a830' : '#666' }}>
                                {condLabel} ({g.current}/{c.count})
                              </span>
                              <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, flexShrink: 0, marginLeft: 4 }}>
                                <div style={{ width: `${pct * 100}%`, height: '100%', background: g.met ? 'var(--gold)' : '#555', borderRadius: 2, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          </div>
                          {g.met && (
                            <span style={{ fontSize: '0.5625rem', color: 'var(--gold)', fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>ON</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            )
          })()}
        </div>
        )}

        </>)}

        {/* ── 덱 노트 ───────────────────────────────────────── */}
        {tab === 'note' && (<div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: '#6a6a80', fontSize: '0.625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>덱 노트</span>
            <button
              onClick={() => setDescPreview(v => !v)}
              className="text-xs px-2 py-0.5 rounded transition-all"
              style={{ color: descPreview ? 'var(--gold)' : '#6a6a80', border: `1px solid ${descPreview ? 'var(--gold)' : 'var(--border)'}`, background: descPreview ? 'rgba(200,144,10,0.08)' : 'transparent' }}
            >
              {descPreview ? '편집' : '미리보기'}
            </button>
          </div>

          {/* 인서트 도구모음 */}
          {!descPreview && (
            <div style={{ background: 'rgba(5,4,2,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {Object.values(deckSlots).filter(Boolean).length === 0 ? (
                <div className="px-4 py-3">
                  <span style={{ color: '#252530', fontSize: '0.5625rem' }}>인격을 편성하면 스킬·패시브·E.G.O를 삽입할 수 있습니다</span>
                </div>
              ) : (
                <div className="flex flex-col">
                  {/* ── 스킬 ── */}
                  <div className="flex items-start gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: '#555570', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', paddingTop: '4px', minWidth: '36px', flexShrink: 0 }}>스킬</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 flex-1">
                      {Object.values(deckSlots).filter((id): id is Identity => !!id).map(identity => {
                        const idSkills = skillsByIdentityId[identity.id] ?? []
                        if (idSkills.length === 0) return null
                        const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
                        const noteSkillImgIdx = computeSkillImageIndices(idSkills)
                        return (
                          <div key={identity.id} className="flex items-center gap-1.5">
                            <Image src={getSinnerLogoUrl(identity.sinner_id)} alt="" width={10} height={10} unoptimized style={{ opacity: 0.3, flexShrink: 0 }} />
                            <div className="flex items-center gap-1">
                              {idSkills.map(sk => {
                                const iconUrl = getSkillIconUrl(identity, noteSkillImgIdx[sk.id] ?? sk.skill_order)
                                return (
                                  <button
                                    key={sk.id}
                                    onClick={() => noteAc.insertToken(`[s:${sinnerName}:${sk.skill_order}]`)}
                                    title={`${identity.name_kr} 스킬 ${sk.skill_order}`}
                                    style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#0d0a06', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                                  >
                                    {iconUrl && <Image src={iconUrl} alt="" width={24} height={24} unoptimized />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── 서포트 패시브 ── */}
                  {(() => {
                    const items = Object.values(deckSlots).filter((id): id is Identity => !!id).flatMap(identity =>
                      (passivesByIdentityId[identity.id] ?? []).filter(p => p.passive_type === 'support')
                    )
                    if (items.length === 0) return null
                    return (
                      <div className="flex items-start gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ color: '#555570', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', paddingTop: '3px', minWidth: '36px', flexShrink: 0 }}>패시브</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {items.map(p => {
                            const sinType = SIN_KR_TO_TYPE[p.sin_affinity!]
                            const sinColor = sinType ? SIN_COLORS[sinType] : '#667788'
                            return (
                              <button
                                key={p.id}
                                onClick={() => noteAc.insertToken(`[p:${p.name}]`)}
                                title={p.name}
                                className="flex items-center gap-1 px-2 py-0.5 rounded"
                                style={{ background: `${sinColor}18`, border: `1px solid ${sinColor}35`, cursor: 'pointer' }}
                              >
                                {sinType && (
                                  <Image src={SIN_ICON_MAP[sinType]} alt="" width={10} height={10} unoptimized />
                                )}
                                <span style={{ color: sinColor, fontSize: '0.6875rem', fontWeight: 600 }}>{p.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── E.G.O ── */}
                  {(() => {
                    const items = Object.values(deckSlots).filter((id): id is Identity => !!id).flatMap(identity => {
                      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
                      return Object.values(egoSlots[identity.sinner_id] ?? {}).map(ego => ({ ego, sinnerName }))
                    })
                    if (items.length === 0) return null
                    return (
                      <div className="flex items-start gap-3 px-4 py-2.5">
                        <span style={{ color: '#555570', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', paddingTop: '3px', minWidth: '36px', flexShrink: 0 }}>E.G.O</span>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {items.map(({ ego, sinnerName }) => {
                            const gradeColor = GRADE_COLORS[ego.grade ?? ''] ?? '#667788'
                            return (
                              <button
                                key={ego.id}
                                onClick={() => noteAc.insertToken(`[e:${sinnerName}:${ego.name_kr || ego.name}]`)}
                                title={`${ego.name_kr || ego.name}`}
                                className="flex items-center gap-1 px-2 py-0.5 rounded"
                                style={{ background: `${gradeColor}18`, border: `1px solid ${gradeColor}35`, cursor: 'pointer' }}
                              >
                                {ego.image_url && (
                                  <Image src={ego.image_url} alt="" width={14} height={14} unoptimized style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                )}
                                <span style={{ color: gradeColor, fontSize: '0.5625rem', fontWeight: 600 }}>{ego.name_kr || ego.name}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

            </div>
          )}

          {/* 편집 / 미리보기 영역 */}
          {descPreview ? (
            <div className="px-4 py-3" style={{ background: 'rgba(5,4,2,0.3)', minHeight: '80px' }}>
              <NoteRenderer
                text={description}
                skillLookup={skillTokenLookup}
                passiveLookup={passiveTokenLookup}
                egoLookup={egoTokenLookup}
                egoGiftLookup={egoGiftLookup}
              />
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <NoteAutocompleteDropdown
                suggestions={noteAc.suggestions}
                selectedIdx={noteAc.selectedIdx}
                onSelect={noteAc.select}
                onHover={noteAc.setSelectedIdx}
              />
              <textarea
                ref={textareaRef}
                placeholder="덱 운용 메모... 키워드/스킬/에고를 입력하면 자동완성됩니다"
                value={description}
                onChange={e => {
                  setDescription(e.target.value)
                  noteAc.onTextChange(e)
                }}
                onSelect={noteAc.onTextSelect}
                onKeyDown={noteAc.handleKeyDown}
                className="w-full px-4 py-4 text-sm outline-none resize-none"
                style={{ background: 'rgba(5,4,2,0.3)', color: '#c8c0b0', border: 'none', fontFamily: 'var(--font-body)', lineHeight: 1.8, display: 'block', minHeight: '220px' }}
                onFocus={e => (e.target.style.background = 'rgba(8,6,3,0.5)')}
                onBlur={e => {
                  e.target.style.background = 'rgba(5,4,2,0.3)'
                  setTimeout(() => noteAc.closeDropdown(), 150)
                }}
              />
            </div>
          )}
        </div>)}

      </div>

      {/* ── 인격 선택 모달 ──────────────────────────────── */}
      {modalSinnerId && tab === 'identity' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={() => setModalSinnerId(null)}>
          <div className="card flex flex-col" style={{ width: '600px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="font-serif font-bold" style={{ color: 'var(--gold)', fontSize: '1.125rem' }}>{modalSinner?.name_kr}</h2>
                <p style={{ color: '#555566', fontSize: '0.6875rem', marginTop: '2px' }}>인격을 선택하세요</p>
              </div>
              <div className="flex items-center gap-3">
                {deckSlots[modalSinnerId] && (
                  <button
                    onClick={() => { setDeckSlots(prev => { const n = { ...prev }; delete n[modalSinnerId]; return n }); setModalSinnerId(null) }}
                    className="text-xs px-3 py-1.5 rounded transition-all hover:bg-red-900/20"
                    style={{ color: '#cc4444', border: '1px solid rgba(200,48,32,0.3)' }}
                  >편성 해제</button>
                )}
                <button onClick={() => setModalSinnerId(null)} style={{ color: '#555566', fontSize: '1.375rem', lineHeight: 1, padding: '0 4px' }}>✕</button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-5 flex-1">
              {modalIdentities.length === 0 ? (
                <p className="text-center py-12" style={{ color: '#6a6a80' }}>등록된 인격이 없습니다</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-8">
                  {modalIdentities.map(identity => (
                    <IdentityCard key={identity.id} identity={identity} compact selected={deckSlots[modalSinnerId]?.id === identity.id} onClick={() => handleIdentitySelect(identity)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 에고 선택 모달 ──────────────────────────────── */}
      {modalSinnerId && modalGrade && tab === 'ego' && (() => {
        const gc = GRADE_COLORS[modalGrade] ?? '#667788'
        const gradeEgos = modalEgos.filter(e => e.grade === modalGrade)
        const currentEgo = egoSlots[modalSinnerId]?.[modalGrade]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.82)' }} onClick={closeEgoModal}>
            <div className="card flex flex-col" style={{ width: '480px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  {modalGrade !== 'ALEPH' ? (
                    <Image src={`${STORAGE_BASE}/icons/grade/${modalGrade}.webp`} alt={modalGrade} width={32} height={16} unoptimized style={{ height: '16px', width: 'auto', opacity: 0.9 }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: gc, letterSpacing: '0.1em' }}>ALEPH</span>
                  )}
                  <div>
                    <h2 className="font-serif font-bold" style={{ color: 'var(--gold)', fontSize: '1.0625rem' }}>{modalSinner?.name_kr}</h2>
                    <p style={{ color: gc, fontSize: '0.625rem', marginTop: '1px', fontFamily: 'var(--font-mono)' }}>{modalGrade} E.G.O</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {currentEgo && (
                    <button
                      onClick={() => {
                        setEgoSlots(prev => {
                          const s = { ...(prev[modalSinnerId] ?? {}) }
                          delete s[modalGrade]
                          return { ...prev, [modalSinnerId]: s } as Record<string, Record<string, EGO>>
                        })
                        closeEgoModal()
                      }}
                      className="text-xs px-3 py-1.5 rounded transition-all hover:bg-red-900/20"
                      style={{ color: '#cc4444', border: '1px solid rgba(200,48,32,0.3)' }}
                    >해제</button>
                  )}
                  <button onClick={closeEgoModal} style={{ color: '#555566', fontSize: '1.375rem', lineHeight: 1, padding: '0 4px' }}>✕</button>
                </div>
              </div>
              <div className="overflow-y-auto px-5 py-5 flex-1">
                {gradeEgos.length === 0 ? (
                  <p className="text-center py-12" style={{ color: '#6a6a80' }}>이 등급의 E.G.O가 없습니다</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-5">
                    {gradeEgos.map(ego => {
                      const sinColor = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                      const isSelected = currentEgo?.id === ego.id
                      return (
                        <button
                          key={ego.id}
                          onClick={() => handleEgoSelect(ego)}
                          className="flex flex-col items-center gap-2"
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{
                            position: 'relative', width: '90px', height: '90px',
                            borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            border: `2px solid ${isSelected ? sinColor : sinColor + '55'}`,
                            boxShadow: isSelected ? `0 0 16px ${sinColor}80` : `0 0 6px ${sinColor}25`,
                            background: '#0d0a06', transition: 'all 0.2s',
                          }}>
                            {ego.image_url
                              ? <Image src={ego.image_url} alt="" fill unoptimized className="object-cover" style={{ objectPosition: '50% 10%' }} />
                              : <div className="w-full h-full flex items-center justify-center"><span style={{ fontFamily: 'monospace', color: gc, fontSize: '0.75rem' }}>{ego.grade?.[0]}</span></div>
                            }
                          </div>
                          <p className="font-serif font-bold leading-snug text-center" style={{ color: isSelected ? '#f0d060' : '#c8a450', fontSize: '0.75rem' }}>{ego.name_kr || ego.name}</p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
