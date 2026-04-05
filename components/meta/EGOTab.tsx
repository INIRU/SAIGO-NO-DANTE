'use client'

import Image from 'next/image'
import { useQueryState, parseAsString } from 'nuqs'
import { SinType, SIN_COLORS, GRADE_COLORS, getSinnerLogoUrl } from '@/lib/data/sinners'
import SinBadge from '@/components/ui/SinBadge'
import type { Sinner } from '@/lib/data/sinners'
import type { MetaData, EGOStat } from '@/lib/db/meta'
import { useProgressiveRender } from '@/hooks/useProgressiveRender'
import { GRADE_ORDER, GRADE_ICON_URL } from './metaConstants'

interface EGOTabProps {
  data: MetaData
  sinnerMap: Map<string, Sinner>
  egoByGrade: Record<string, EGOStat[]>
}

export default function EGOTab({ data, sinnerMap, egoByGrade }: EGOTabProps) {
  const [gradeTab, setGradeTab] = useQueryState('grade', parseAsString.withDefault('ALL'))
  const globalMax = data.egoStats[0]?.count || 1

  const availableGrades = GRADE_ORDER.filter(g => egoByGrade[g]?.length)

  const displayEgos = gradeTab === 'ALL'
    ? data.egoStats.slice(0, 30)
    : (egoByGrade[gradeTab] ?? [])
  const displayMax = displayEgos[0]?.count || 1
  const { visible: egoVisible, sentinelRef: egoSentinelRef } = useProgressiveRender(displayEgos.length)

  return (
    <div className="max-w-4xl">
      <h2 className="font-serif text-xl font-semibold mb-2" style={{ color: 'var(--gold-light)' }}>
        EGO 채용률
      </h2>
      <p className="text-xs mb-6" style={{ color: '#888888' }}>
        등급별 EGO 사용 현황
      </p>

      {/* 등급 서브탭 */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setGradeTab(null)}
          className="px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider transition-all"
          style={{
            background: gradeTab === 'ALL' ? 'var(--gold)' : 'rgba(255,255,255,0.05)',
            color: gradeTab === 'ALL' ? 'var(--bg-deep)' : '#666688',
          }}
        >
          전체
        </button>
        {availableGrades.map(grade => {
          const gc = GRADE_COLORS[grade] || '#666'
          const active = gradeTab === grade
          return (
            <button
              key={grade}
              onClick={() => setGradeTab(active ? null : grade)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold tracking-wider transition-all"
              style={{
                background: active ? `${gc}30` : 'rgba(255,255,255,0.05)',
                color: active ? gc : '#555566',
                border: active ? `1px solid ${gc}50` : '1px solid transparent',
              }}
            >
              {GRADE_ICON_URL[grade] ? (
                <Image src={GRADE_ICON_URL[grade]} alt={grade} width={28} height={11} style={{ opacity: active ? 1 : 0.5 }} />
              ) : (
                grade
              )}
              <span className="text-[0.625rem]" style={{ color: '#888888' }}>
                {egoByGrade[grade]?.length ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* EGO 리스트 */}
      <div className="usage-chart space-y-2">
        {displayEgos.slice(0, egoVisible).map((ego, i) => {
          const pct = (ego.count / (gradeTab === 'ALL' ? globalMax : displayMax)) * 100
          const gradeColor = GRADE_COLORS[ego.grade] || '#666'
          const sinColor = ego.sin_affinity
            ? SIN_COLORS[ego.sin_affinity as SinType] || gradeColor
            : gradeColor
          const sName = sinnerMap.get(ego.sinner_id)?.name_kr ?? ''

          return (
            <div
              key={ego.ego_id}
              className="rounded-lg overflow-hidden"
              style={{
                background: 'rgba(26,21,16,0.6)',
                border: i < 3 ? `1px solid ${gradeColor}25` : '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <div className="p-3 flex items-center gap-3">
                {/* 순위 */}
                <span
                  className="font-mono text-sm w-6 text-center font-bold shrink-0"
                  style={{
                    color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#555566',
                  }}
                >
                  {i + 1}
                </span>

                {/* 등급 이미지 */}
                <div className="w-8 flex items-center justify-center shrink-0">
                  {GRADE_ICON_URL[ego.grade] ? (
                    <Image src={GRADE_ICON_URL[ego.grade]} alt={ego.grade} width={30} height={12} />
                  ) : (
                    <span
                      className="font-mono text-[0.625rem] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${gradeColor}15`, color: gradeColor, border: `1px solid ${gradeColor}30` }}
                    >
                      {ego.grade}
                    </span>
                  )}
                </div>

                {/* EGO 초상화 */}
                <div className="relative shrink-0 overflow-hidden" style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', border: `1.5px solid ${gradeColor}40`, background: '#0d0b08' }}>
                  {ego.image_url ? (
                    <Image src={ego.image_url} alt="" fill className="object-cover" style={{ objectPosition: '50% 15%' }} sizes="60px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image src={getSinnerLogoUrl(ego.sinner_id)} alt="" width={18} height={18} style={{ height: 'auto', opacity: 0.5 }} />
                    </div>
                  )}
                </div>

                {/* EGO명 + 수감자 + 죄악 */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate" style={{ color: '#e8e4d8' }}>
                    {ego.name_kr}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: '#888888' }}>
                    {sName}
                  </span>
                  {ego.sin_affinity && (
                    <SinBadge sin={ego.sin_affinity as SinType} size="sm" showLabel={false} />
                  )}
                </div>

                {/* 카운트 */}
                <span
                  className="count-up font-mono text-sm font-bold shrink-0 w-8 text-right"
                  data-target={ego.count}
                  style={{ color: gradeColor }}
                >
                  {ego.count}
                </span>
              </div>

              {/* 바 */}
              <div className="h-1 overflow-hidden">
                <div
                  className="usage-bar h-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(to right, ${sinColor}30, ${sinColor})`,
                  }}
                />
              </div>
            </div>
          )
        })}
        {displayEgos.length === 0 && (
          <p className="text-center py-12" style={{ color: '#888888' }}>데이터가 없습니다</p>
        )}
        <div ref={egoSentinelRef} />
      </div>
    </div>
  )
}
