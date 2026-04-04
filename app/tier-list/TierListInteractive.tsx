'use client'

import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { Calculator, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { SelectionProvider, useSelection } from './SelectionContext'
import type { TierIdentity } from './TierCardInteractive'

const TIERS = ['S+', 'S', 'A', 'B', 'C', 'F'] as const
type Tier = typeof TIERS[number]

const TIER_COLORS: Record<Tier, string> = {
  'S+': '#ff5050',
  'S': '#ffa030',
  'A': '#ffd040',
  'B': '#60c860',
  'C': '#60a0ff',
  'F': '#909090',
}

const TIER_SCORES: Record<Tier, number> = {
  'S+': 3.0,
  'S': 2.5,
  'A': 2.0,
  'B': 1.5,
  'C': 1.0,
  'F': 0,
}

const QNA = [
  {
    q: 'Q1. 림버스는 리세가 필수인가요?',
    a: '필수는 아닙니다. 다만 맨땅계는 초반 던전 파밍과 스토리 진행이 비교적 느립니다.\n림버스의 리세는 쉽고 빠른 편이기에 리세를 통해 좋은 계정을 가져가는걸 추천합니다. (약 2분 소요)',
  },
  {
    q: 'Q2. 리세계와 돌계, 어느것이 더 좋나요?',
    a: '돌계의 재화량이 상당히 많기에 게임에 돈을 어느정도 사용할 생각이 있다면 돌계를 좀 더 추천합니다.\n다만 리세계로도 게임 진행은 큰 문제 없이 가능하기에 반드시 돌계를 구매해야 하는 것은 아닙니다.',
  },
  {
    q: 'Q3. 리세계를 구매해도 되나요?',
    a: '리세계 구매는 하지마십시오.\n리세계는 만들기 쉽고 갤 내에서 나눔도 진행하고 있습니다.\n만약 계정을 구매하실 생각이 있다면 돌계를 추천합니다.',
  },
  {
    q: 'Q4. 이륙 질문글 너무 계속 자주 올리는 것 같은데 괜찮나요?',
    a: '괜찮습니다. 필요할 때마다 올려도 문제 없습니다.',
  },
  {
    q: 'Q5. 신입 관리자 출석 보상의 1시즌 선택권은 어떤 인격을 고르는게 좋나요?',
    a: "일반적으로 '쥐어들 자 싱클레어'를 추천합니다.\n선택권으로 얻을 수 있어 A티어에 위치해 있지만, 높은 체급과 강력한 딜로 초반 스토리는 아주 잘 밀어주는 든든한 인격입니다.\n\n이미 싱클레어의 유효 인격이 있다면, 쥐는 자 파우스트 혹은 콩콩이파 두목 홍루를 추천합니다.\n\n만약 싱클레어, 파우스트, 홍루의 유효 인격을 이미 보유 중이라면 티켓은 굳이 사용하지 않고 아껴두셔도 좋습니다.",
  },
  {
    q: 'Q6. 리세 도중 동그란 에고라는게 나왔는데 이건 뭔가요?',
    a: '각 캐릭터의 특수 스킬같은 개념입니다. 보통 리세에서 유효픽으로 취급하지 않습니다.',
  },
  {
    q: 'Q7. 한 캐릭터에 인격이 여러개 뜨면 좋은건가요 나쁜건가요?',
    a: '리세에서는 아쉬운 상황입니다.\n한 전투에서 캐릭터 당 하나의 인격만 사용할 수 있기에, 캐릭터가 겹치지 않게 인격이 나오는 상황이 더 좋다고 할 수 있습니다.',
  },
]

// Inner component that consumes context (must be inside SelectionProvider)
function TierListInner({
  tiers,
  children,
}: {
  tiers: Record<Tier, TierIdentity[]>
  children: ReactNode
}) {
  const { selected, clearAll } = useSelection()
  const [calcOpen, setCalcOpen] = useState(false)
  const [qnaOpen, setQnaOpen] = useState(false)

  const animRef = useRef(false)
  useEffect(() => {
    if (animRef.current) return
    animRef.current = true
    import('gsap').then(({ gsap }) => {
      gsap.fromTo('.tier-header',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
      )
      gsap.fromTo('.tier-row',
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out', delay: 0.3 }
      )
    })
  }, [])

  // identity id → { tier, sinner_id, name_kr } mapping for calculator
  const identityMap = useMemo(() => {
    const map = new Map<string, { tier: Tier; sinner_id: string; name_kr: string }>()
    for (const tier of TIERS) {
      for (const ident of tiers[tier]) {
        map.set(ident.id, { tier, sinner_id: ident.sinner_id, name_kr: ident.name_kr })
      }
    }
    return map
  }, [tiers])

  const calcResult = useMemo(() => {
    if (selected.size === 0) return { score: 0, details: [], dupes: [] as string[] }

    const sinnerBest = new Map<string, { tier: Tier; score: number; name_kr: string }>()
    const dupes: string[] = []

    for (const id of selected) {
      const info = identityMap.get(id)
      if (!info) continue
      const score = TIER_SCORES[info.tier]
      const existing = sinnerBest.get(info.sinner_id)
      if (existing) {
        if (score > existing.score) {
          dupes.push(existing.name_kr)
          sinnerBest.set(info.sinner_id, { tier: info.tier, score, name_kr: info.name_kr })
        } else {
          dupes.push(info.name_kr)
        }
      } else {
        sinnerBest.set(info.sinner_id, { tier: info.tier, score, name_kr: info.name_kr })
      }
    }

    const details = Array.from(sinnerBest.values())
    const totalScore = details.reduce((sum, d) => sum + d.score, 0)
    return { score: totalScore, details, dupes }
  }, [selected, identityMap])

  const hasTiers = TIERS.some(t => tiers[t].length > 0)

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pt-28 pb-16" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background atmospheric glow */}
      <div style={{
        position: 'fixed',
        top: '-10rem',
        right: '-5rem',
        width: '35rem',
        height: '35rem',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="tier-header">
          <p className="text-center" style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>REROLL TIER LIST</p>
          <h1
            className="font-serif text-center mb-2"
            style={{ color: 'var(--gold)', fontSize: '1.5rem', fontWeight: 700 }}
          >
            리세마라 티어표
          </h1>
          <p className="text-center mb-1" style={{ color: '#888888', fontSize: '0.8125rem' }}>
            림버스 컴퍼니 리세마라 추천 인격 티어
          </p>
          <p className="text-center mb-2" style={{ color: '#888888', fontSize: '0.6875rem' }}>
            인격을 눌러 뽑은 인격을 선택하면 이륙 자가진단을 할 수 있습니다
          </p>
          <p className="text-center mb-4" style={{ fontSize: '0.6875rem' }}>
            <a
              href="https://gall.dcinside.com/mgallery/board/view/?id=limbuscompany&no=375877"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-yellow-300"
              style={{ color: '#3a3028' }}
            >
              원본: 림버스 컴퍼니 갤러리
            </a>
          </p>
          <div style={{ width: '8rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '1rem', marginBottom: '0.5rem', marginLeft: 'auto', marginRight: 'auto' }} />
        </div>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-5 mb-6" style={{ fontSize: '0.6875rem' }}>
          <span className="flex items-center gap-1.5">
            <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '0.125rem', background: '#60c860', display: 'inline-block' }} />
            <span style={{ color: '#8a8a8a' }}>발푸르기스 밤</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '0.125rem', background: '#ffd040', display: 'inline-block' }} />
            <span style={{ color: '#8a8a8a' }}>추출만 가능</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '0.125rem', background: '#ff5050', display: 'inline-block' }} />
            <span style={{ color: '#8a8a8a' }}>이번 시즌 획득 불가</span>
          </span>
        </div>

        {/* 점수 기준 */}
        <div
          className="flex items-center justify-center gap-3 mb-8 flex-wrap"
          style={{ fontSize: '0.6875rem' }}
        >
          {TIERS.filter(t => TIER_SCORES[t] > 0).map(tier => (
            <span key={tier} className="flex items-center gap-1">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1.5rem',
                  height: '1.125rem',
                  borderRadius: '0.1875rem',
                  background: TIER_COLORS[tier],
                  color: '#fff',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {tier}
              </span>
              <span style={{ color: '#8a8a8a' }}>+{TIER_SCORES[tier].toFixed(1)}점</span>
            </span>
          ))}
        </div>

        {!hasTiers ? (
          <div className="text-center py-20">
            <p style={{ color: '#888888', fontSize: '0.875rem' }}>
              아직 티어표가 작성되지 않았습니다.
            </p>
          </div>
        ) : (
          <>
            {/* Tier grid — rendered by server component passed as children */}
            {children}

            {/* 자가진단 계산기 (플로팅) */}
            {selected.size > 0 && (
              <div
                style={{
                  position: 'fixed',
                  bottom: '1.25rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 50,
                  background: '#1a1510',
                  border: '1px solid var(--gold-dim)',
                  borderRadius: '0.75rem',
                  padding: calcOpen ? '1rem 1.25rem' : '0.625rem 1.25rem',
                  boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.6), 0 0 0 1px rgba(200,144,10,0.1)',
                  minWidth: '17.5rem',
                  maxWidth: '26.25rem',
                  width: '90%',
                  transition: 'all 0.2s',
                }}
              >
                {/* 요약 행 */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCalcOpen(v => !v)}
                    className="flex items-center gap-2"
                    style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                  >
                    <Calculator size={16} style={{ color: 'var(--gold)' }} />
                    <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', fontSize: '0.875rem' }}>
                      자가진단
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: calcResult.score >= 7.0 ? '#60c860' : calcResult.score >= 5.5 ? '#ffd040' : '#ff5050',
                      }}
                    >
                      {calcResult.score.toFixed(1)}점
                    </span>
                    {calcOpen ? <ChevronDown size={14} style={{ color: '#888888' }} /> : <ChevronUp size={14} style={{ color: '#888888' }} />}
                  </button>
                  <button
                    onClick={clearAll}
                    style={{ cursor: 'pointer', background: 'none', border: 'none', padding: '0.25rem' }}
                    title="초기화"
                  >
                    <RotateCcw size={14} style={{ color: '#888888' }} />
                  </button>
                </div>

                {/* 상세 */}
                {calcOpen && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
                      {calcResult.details.map((d, i) => (
                        <div key={i} className="flex items-center justify-between" style={{ fontSize: '0.75rem' }}>
                          <span style={{ color: '#c8a450' }}>{d.name_kr}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '1.25rem',
                                height: '0.875rem',
                                borderRadius: '0.125rem',
                                background: TIER_COLORS[d.tier],
                                color: '#fff',
                                fontSize: '0.5625rem',
                                fontWeight: 700,
                              }}
                            >
                              {d.tier}
                            </span>
                            <span style={{ color: '#8a8a8a', fontFamily: 'var(--font-mono)' }}>
                              +{d.score.toFixed(1)}
                            </span>
                          </span>
                        </div>
                      ))}
                      {calcResult.dupes.map((name, i) => (
                        <div key={`dupe-${i}`} className="flex items-center justify-between" style={{ fontSize: '0.75rem' }}>
                          <span style={{ color: '#888888', textDecoration: 'line-through' }}>{name}</span>
                          <span style={{ color: '#888888', fontSize: '0.625rem' }}>중복 무효</span>
                        </div>
                      ))}
                    </div>

                    {/* 판정 */}
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        background: calcResult.score >= 7.0 ? 'rgba(96,200,96,0.1)' : calcResult.score >= 5.5 ? 'rgba(255,208,64,0.1)' : 'rgba(255,80,80,0.1)',
                        border: `1px solid ${calcResult.score >= 7.0 ? 'rgba(96,200,96,0.2)' : calcResult.score >= 5.5 ? 'rgba(255,208,64,0.2)' : 'rgba(255,80,80,0.2)'}`,
                        textAlign: 'center',
                      }}
                    >
                      <p style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: calcResult.score >= 7.0 ? '#60c860' : calcResult.score >= 5.5 ? '#ffd040' : '#ff5050',
                      }}>
                        {calcResult.score >= 7.0
                          ? '무조건 이륙을 추천합니다!'
                          : calcResult.score >= 5.5
                          ? '이륙을 권장합니다'
                          : '리세를 더 해보세요'}
                      </p>
                      {calcResult.score >= 5.5 && calcResult.score < 7.0 && (
                        <p style={{ fontSize: '0.6875rem', color: '#8a8a8a', marginTop: '0.125rem' }}>
                          애매하다면 갤러리에 이륙 질문글을 올려보세요
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Q&A */}
            <div style={{ marginTop: '3rem' }}>
              <button
                onClick={() => setQnaOpen(v => !v)}
                className="flex items-center gap-2 w-full transition-colors hover:opacity-80"
                style={{
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <h2 className="font-serif" style={{ color: 'var(--gold)', fontSize: '1rem', fontWeight: 700 }}>
                  뉴비 Q&amp;A
                </h2>
                {qnaOpen ? <ChevronUp size={16} style={{ color: '#888888' }} /> : <ChevronDown size={16} style={{ color: '#888888' }} />}
              </button>

              {qnaOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
                  {QNA.map((item, i) => (
                    <div key={i}>
                      <p style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                        {item.q}
                      </p>
                      <p style={{ color: '#8a8a8a', fontSize: '0.8125rem', lineHeight: 1.7, whiteSpace: 'pre-line', paddingLeft: '0.75rem' }}>
                        {item.a}
                      </p>
                    </div>
                  ))}

                  {/* 고인물 안내 */}
                  <div
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem 1rem',
                      background: 'rgba(200,144,10,0.05)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.375rem',
                    }}
                  >
                    <p style={{ color: '#8a7855', fontSize: '0.75rem', lineHeight: 1.7 }}>
                      해당 티어표는 신입 관리자의 &apos;굿스터프&apos; 덱을 기준으로 작성되었으므로
                      키워드 유지가 어려운 출혈, 파열 인격의 경우 생각보다 티어가 낮다고 느낄 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 패딩 (플로팅 계산기 겹침 방지) */}
            {selected.size > 0 && <div style={{ height: '5rem' }} />}
          </>
        )}
      </div>
    </div>
  )
}

export default function TierListInteractive({
  tiers,
  currentSeason,
  children,
}: {
  tiers: Record<Tier, TierIdentity[]>
  currentSeason: number
  children: ReactNode
}) {
  return (
    <SelectionProvider>
      <TierListInner tiers={tiers} children={children} />
    </SelectionProvider>
  )
}
