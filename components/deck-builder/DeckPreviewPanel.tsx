'use client'

import Image from 'next/image'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  Passive,
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
  SIN_ORDER,
  type ActivationCondition,
} from '@/lib/data/sinners'
import PassiveBadge from './PassiveBadge'
import { useKeywordData } from '@/components/providers/KeywordProvider'

const RES_COLORS: Record<string, string> = {
  '효율': '#c83040', '취약': '#c83040',
  '보통': '#888899',
  '내성': '#4898b0', '견딤': '#4898b0',
  '무효': '#334455',
}

interface GiftStatus {
  name: string
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  condition: ActivationCondition
  current: number
  met: boolean
}

interface Props {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  egoSlots: Record<string, Record<string, EGO>>
  skillsByIdentityId: Record<string, Skill[]>
  passivesByIdentityId: Record<string, Passive[]>
  sinCostTotals: number[]
  atkTypeTotals: Record<string, number>
  activatableGifts: GiftStatus[]
  contentType: string
  showCostDetail: boolean
  setShowCostDetail: (v: boolean | ((prev: boolean) => boolean)) => void
  showIdentityDetail: boolean
  setShowIdentityDetail: (v: boolean | ((prev: boolean) => boolean)) => void
  showPassiveDetail: boolean
  setShowPassiveDetail: (v: boolean | ((prev: boolean) => boolean)) => void
  showGiftPanel: boolean
  setShowGiftPanel: (v: boolean | ((prev: boolean) => boolean)) => void
  giftTabKw: string
  setGiftTabKw: (kw: string) => void
}

export default function DeckPreviewPanel({
  sinners, deckSlots, egoSlots, skillsByIdentityId, passivesByIdentityId,
  sinCostTotals, atkTypeTotals, activatableGifts,
  contentType,
  showCostDetail, setShowCostDetail,
  showIdentityDetail, setShowIdentityDetail,
  showPassiveDetail, setShowPassiveDetail,
  showGiftPanel, setShowGiftPanel,
  giftTabKw, setGiftTabKw,
}: Props) {
  const { getIconUrl } = useKeywordData()
  // 덱 전체 스킬 죄악 합산 (패시브 패널용)
  const deckSinCounts: Record<string, number> = {}
  for (const sinner of sinners) {
    const id = deckSlots[sinner.id]
    if (!id) continue
    for (const sk of skillsByIdentityId[id.id] ?? []) {
      if (sk.sin_affinity) deckSinCounts[sk.sin_affinity] = (deckSinCounts[sk.sin_affinity] ?? 0) + 1
    }
  }

  return (
    <>
      {/* ── 죄악 자원 패널 ──────────────────────────────── */}
      <div className="mt-8" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        {/* 요약 바 */}
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>죄악 자원</span>
          <div className="flex items-center gap-4 flex-1 flex-wrap">
            {SIN_ORDER.map((sin, i) => {
              const total = sinCostTotals[i]
              if (total === 0) return null
              return (
                <div key={sin} className="flex items-center gap-1">
                  <Image src={SIN_ICON_MAP[sin]} alt={SIN_LABELS_KR[sin]} width={18} height={18} />
                  <span style={{ color: SIN_COLORS[sin], fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{total}</span>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => setShowCostDetail(v => !v)}
            className="text-xs px-2.5 py-1 rounded transition-all"
            style={{ color: showCostDetail ? 'var(--gold)' : 'var(--text-secondary)', border: `1px solid ${showCostDetail ? 'var(--gold)' : 'var(--border)'}`, background: showCostDetail ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
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
                        ? <Image src={ego.image_url} alt="" fill className="object-cover" style={{ objectPosition: '50% 10%' }} sizes="40px" />
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
                        <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={10} height={10} style={{ opacity: 0.4 }} />
                        <span style={{ color: '#6a5e38', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{sinner.name_kr}</span>
                      </div>
                      <p style={{ color: sc, fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>{ego.name_kr || ego.name}</p>
                    </div>

                    {/* 공격 유형 */}
                    <div style={{ flexShrink: 0, width: '24px' }}>
                      {atkType && ATK_TYPE_ICON_MAP[atkType] && (
                        <Image src={ATK_TYPE_ICON_MAP[atkType]} alt={atkType} title={atkType} width={18} height={18} style={{ opacity: 0.85 }} />
                      )}
                    </div>

                    {/* 죄악 비용 — 7칸 고정 */}
                    <div className="flex items-center gap-3 flex-1">
                      {SIN_ORDER.map((sin, i) => {
                        const cost = ego.cost?.[i] ?? 0
                        return (
                          <div key={sin} className="flex items-center gap-0.5" style={{ opacity: cost === 0 ? 0.15 : 1, minWidth: '28px' }}>
                            <Image src={SIN_ICON_MAP[sin]} alt="" width={14} height={14} />
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
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>공격 유형</span>
          <div className="flex items-center gap-4 flex-1">
            {(['slash', 'pierce', 'blunt'] as const).map(type => {
              const count = atkTypeTotals[type]
              if (count === 0) return null
              return (
                <div key={type} className="flex items-center gap-1">
                  <Image src={ATK_TYPE_ICON_MAP[type]} alt={type} width={16} height={16} />
                  <span style={{ color: '#aaaaaa', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => setShowIdentityDetail(v => !v)}
            className="text-xs px-2.5 py-1 rounded transition-all"
            style={{ color: showIdentityDetail ? 'var(--gold)' : 'var(--text-secondary)', border: `1px solid ${showIdentityDetail ? 'var(--gold)' : 'var(--border)'}`, background: showIdentityDetail ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
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
                      <Image src={getIdentityInfoUrl(identity)} alt="" fill className="object-cover object-top" sizes="60px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span style={{ color: '#6a5e38', fontSize: '0.875rem' }}>{identity.name_kr?.[0]}</span>
                      </div>
                    )}
                  </div>

                  {/* 수감자 + 인격명 */}
                  <div style={{ minWidth: '150px', flexShrink: 0 }}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ opacity: 0.4 }} />
                      <span style={{ color: '#6a5e38', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{sinner.name_kr}</span>
                    </div>
                    <p style={{ color: '#c8a450', fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.2 }}>{identity.name_kr || identity.name}</p>
                  </div>

                  {/* 스킬 공격 유형 (S1/S2/S3만) */}
                  <div className="flex items-center gap-2 flex-1">
                    {idSkills.filter(s => s.skill_order >= 1 && s.skill_order <= 3).filter((s, sIdx, arr) => arr.findIndex(x => x.skill_order === s.skill_order) === sIdx).map((sk) => {
                      const label = String(sk.skill_order)
                      const iconUrl = getSkillIconUrl(identity, idSkillImgIdx[sk.id] ?? sk.skill_order)
                      const atkIcon = ATK_TYPE_ICON_MAP[sk.skill_type]
                      return (
                        <div key={sk.id} className="flex flex-col items-center gap-0.5" style={{ minWidth: '30px' }}>
                          <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                            {iconUrl ? (
                              <Image src={iconUrl} alt={label} width={24} height={24} style={{ borderRadius: '50%' }} />
                            ) : (
                              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1a1510' }} />
                            )}
                            {atkIcon && (
                              <Image src={atkIcon} alt="" width={11} height={11} style={{ position: 'absolute', bottom: '-2px', right: '-2px' }} />
                            )}
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{label}</span>
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
                          <Image src={ATK_TYPE_ICON_MAP[atkSlug]} alt={atkSlug} width={16} height={16} style={{ opacity: 0.6 }} />
                          <span style={{ color: col, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{val}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {Object.values(deckSlots).filter(Boolean).length === 0 && (
              <p className="text-center py-4" style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>인격을 먼저 편성해주세요</p>
            )}
          </div>
        )}
      </div>

      {/* ── 패시브 패널 ──────────────────────────────────── */}
      <div className="mt-4" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>패시브</span>
          <div className="flex-1" />
          <button
            onClick={() => setShowPassiveDetail(v => !v)}
            className="text-xs px-2.5 py-1 rounded transition-all"
            style={{ color: showPassiveDetail ? 'var(--gold)' : 'var(--text-secondary)', border: `1px solid ${showPassiveDetail ? 'var(--gold)' : 'var(--border)'}`, background: showPassiveDetail ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
          >
            상세보기 {showPassiveDetail ? '▲' : '▼'}
          </button>
        </div>

        {showPassiveDetail && (
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
                      <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ opacity: 0.4 }} />
                      <span style={{ color: '#6a5e38', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>{sinner.name_kr}</span>
                    </div>
                    <p style={{ color: '#c8a450', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1.2 }}>{identity.name_kr || identity.name}</p>
                  </div>

                  {/* 배틀 패시브 */}
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: '4px', letterSpacing: '0.05em' }}>일반 패시브</p>
                    <div className="flex flex-col gap-1.5">
                      {battlePassives.length > 0
                        ? battlePassives.map(p => <PassiveBadge key={p.id} p={p} deckSinCounts={deckSinCounts} />)
                        : <span style={{ color: '#8a8095', fontSize: '0.75rem' }}>-</span>
                      }
                    </div>
                  </div>

                  {/* 구분선 */}
                  <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />

                  {/* 서포트 패시브 */}
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: '4px', letterSpacing: '0.05em' }}>서포트 패시브</p>
                    <div className="flex flex-col gap-1.5">
                      {supportPassives.length > 0
                        ? supportPassives.map(p => <PassiveBadge key={p.id} p={p} deckSinCounts={deckSinCounts} />)
                        : <span style={{ color: '#8a8095', fontSize: '0.75rem' }}>-</span>
                      }
                    </div>
                  </div>
                </div>
              )
            })}
            {Object.values(deckSlots).filter(Boolean).length === 0 && (
              <p className="text-center py-4" style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>인격을 먼저 편성해주세요</p>
            )}
          </div>
        )}
      </div>

      {/* ── 활성 가능 EGO 기프트 패널 (거던 유형만) ─────────────────────── */}
      {['거던5층', '거던10층', '거던15층'].includes(contentType) && (
        <div className="mt-4" style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: 'rgba(10,8,5,0.5)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>E.G.O 기프트</span>
            {activatableGifts.length > 0 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{activatableGifts.filter(g => g.met).length}</span>
                <span> 활성</span>
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setShowGiftPanel(v => !v)}
              className="text-xs px-2.5 py-1 rounded transition-all"
              style={{ color: showGiftPanel ? 'var(--gold)' : 'var(--text-secondary)', border: `1px solid ${showGiftPanel ? 'var(--gold)' : 'var(--border)'}`, background: showGiftPanel ? 'rgba(200,144,10,0.08)' : 'transparent', flexShrink: 0 }}
            >
              상세보기 {showGiftPanel ? '▲' : '▼'}
            </button>
          </div>

          {showGiftPanel && (() => {
            const GIFT_KW_TABS = ['전체', '화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격', '공통'] as const
            const filtered = giftTabKw === '전체'
              ? activatableGifts
              : activatableGifts.filter(g => g.keyword === giftTabKw)
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
                    const kwIcon = kw !== '전체' ? (getIconUrl(kw) ?? ATK_TYPE_ICON_MAP[kw] ?? null) : null
                    const metCount = kw === '전체' ? activatableGifts.filter(g => g.met).length : (metByKw[kw] ?? 0)
                    const totalCount = kw === '전체' ? activatableGifts.length : activatableGifts.filter(g => g.keyword === kw).length
                    if (kw !== '전체' && totalCount === 0) return null
                    return (
                      <button
                        key={kw}
                        onClick={() => setGiftTabKw(kw)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-all"
                        style={{
                          fontSize: '0.75rem', fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'var(--gold)' : '#555',
                          background: isActive ? 'rgba(200,144,10,0.1)' : 'transparent',
                          border: `1px solid ${isActive ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        {kwIcon && <Image src={kwIcon} alt="" width={11} height={11} />}
                        {kw}
                        {metCount > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>{metCount}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* 기프트 목록 */}
                <div style={{ padding: '6px 8px', maxHeight: '320px', overflowY: 'auto' }}>
                  {Object.values(deckSlots).filter(Boolean).length === 0 ? (
                    <p className="text-center py-4" style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>인격을 먼저 편성해주세요</p>
                  ) : filtered.length === 0 ? (
                    <p className="text-center py-3" style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}>해당하는 기프트가 없습니다</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {filtered.map(g => {
                        const c = g.condition
                        const condLabel = c.type === 'keyword' ? `${c.keyword} ${c.count}인`
                          : c.type === 'multi_keyword' ? `${c.keywords!.join('+')} ${c.count}인`
                          : c.type === 'affiliation' ? `${c.affiliation ?? c.affiliations!.join('/')} ${c.count}인`
                          : `${c.count}인`
                        const pct = Math.min(g.current / c.count, 1)
                        const kwIcon = getIconUrl(g.keyword) ?? ATK_TYPE_ICON_MAP[g.keyword] ?? null

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
                              <Image src={g.image_url} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: g.met ? '1.5px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)' }} />
                            ) : (
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1510', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="flex items-center gap-1.5">
                                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: g.met ? 'var(--gold)' : '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#444', flexShrink: 0 }}>{g.grade}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {kwIcon && <Image src={kwIcon} alt="" width={10} height={10} style={{ flexShrink: 0 }} />}
                                <span style={{ fontSize: '0.75rem', color: g.met ? '#88a830' : '#666' }}>
                                  {condLabel} ({g.current}/{c.count})
                                </span>
                                <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, flexShrink: 0, marginLeft: 4 }}>
                                  <div style={{ width: `${pct * 100}%`, height: '100%', background: g.met ? 'var(--gold)' : '#555', borderRadius: 2, transition: 'width 0.3s' }} />
                                </div>
                              </div>
                            </div>
                            {g.met && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0, letterSpacing: '0.05em' }}>ON</span>
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
    </>
  )
}
