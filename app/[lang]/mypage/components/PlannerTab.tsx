'use client'

import { useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import useSWR from 'swr'
import { Plus, Map } from 'lucide-react'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'

// Design Ref: §5.4 — 내 플랜 + 추천 플랜 (lazy load)

export default function PlannerTab() {
  const { data: myData, isLoading: myLoading } = useSWR<{ plans: PlanSummary[] }>('/api/planner?userId=me&limit=50')
  const { data: votedData, isLoading: votedLoading } = useSWR<{ plans: PlanSummary[] }>('/api/planner?votedBy=me&limit=50')
  const myPlans = myData?.plans ?? []
  const votedPlans = votedData?.plans ?? []
  const loading = myLoading || votedLoading
  const [subTab, setSubTab] = useState<'mine' | 'voted'>('mine')

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ background: '#1a1510', border: '1px solid var(--border)', borderRadius: '0.375rem', height: '12rem', opacity: 0.4 + i * 0.15 }} />
        ))}
      </div>
    )
  }

  const activePlans = subTab === 'mine' ? myPlans : votedPlans

  return (
    <>
      {/* 서브탭 + CTA */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1">
          {[
            { key: 'mine' as const, label: '내 플랜', count: myPlans.length },
            { key: 'voted' as const, label: '추천한 플랜', count: votedPlans.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className="px-3 py-1.5 text-xs rounded-md transition-all duration-200"
              style={{
                background: subTab === key ? 'rgba(200,144,10,0.1)' : 'transparent',
                color: subTab === key ? 'var(--gold)' : 'var(--text-tertiary)',
                border: subTab === key ? '1px solid rgba(200,144,10,0.2)' : '1px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {label}
              {count > 0 && (
                <span style={{ marginLeft: '0.375rem', fontFamily: 'var(--font-mono)', fontSize: '0.625rem' }}>{count}</span>
              )}
            </button>
          ))}
        </div>
        <Link
          href="/planner"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
          style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '0.25rem', fontFamily: 'var(--font-heading)' }}
        >
          <Plus size={12} />
          새 플랜
        </Link>
      </div>

      {/* 플랜 목록 */}
      {activePlans.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 gap-4"
          style={{ background: 'linear-gradient(180deg, #1a1510 0%, #120e09 100%)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
        >
          <Map size={28} style={{ color: '#3a2a18', strokeWidth: 1.5 }} />
          <p className="font-serif text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}>
            {subTab === 'mine' ? '아직 작성한 플랜이 없습니다.' : '아직 추천한 플랜이 없습니다.'}
          </p>
          <Link
            href={subTab === 'mine' ? '/planner' : '/planner/community'}
            className="transition-all duration-200 hover:opacity-90"
            style={{ color: 'var(--bg-deep)', background: 'var(--gold)', fontSize: '0.75rem', padding: '0.375rem 1rem', borderRadius: '0.25rem', fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
          >
            {subTab === 'mine' ? '첫 번째 플랜 만들기' : '플래너 커뮤니티 둘러보기'}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {activePlans.map(plan => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </>
  )
}
