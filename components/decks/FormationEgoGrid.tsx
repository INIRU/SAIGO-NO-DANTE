'use client'

import Image from 'next/image'
import { getEgoGradeBannerUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

export type FormationTab<K extends string> = { key: K; label: string; count?: string | null }

/** 편성 영역의 세부 탭(인격 / E.G.O / …). 플랜 상세와 덱 상세가 같이 쓴다. */
export function FormationTabs<K extends string>({ tabs, active, onChange, label, hint }: {
  tabs: FormationTab<K>[]; active: K; onChange: (key: K) => void; label: string; hint?: string | null
}) {
  return (
    // 밑줄은 탭 줄 안쪽 선이라 활성 밑줄이 그 위를 덮는다(음수 여백은 가로 스크롤 줄에 세로 스크롤바를 만들었다)
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div role="tablist" aria-label={label} className="flex min-w-0 max-w-full overflow-x-auto shadow-[inset_0_-1px_0_#2e2417]">
        {tabs.map(tab => {
          const selected = active === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-[0.9375rem] transition-colors first:pl-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#e8b030] motion-reduce:transition-none ${selected
                ? 'border-[#c8900a] font-semibold text-[#e8dcc8]'
                : 'border-transparent text-[#9c8b73] hover:text-[#e8dcc8]'}`}
            >
              {tab.label}
              {tab.count && <span className="font-normal tabular-nums text-[#7f7364]">{tab.count}</span>}
            </button>
          )
        })}
      </div>
      {hint && <p className="pb-2 text-[0.8125rem] text-[#7f7364]">{hint}</p>}
    </div>
  )
}

export type FormationEgo = { id: string; name: string; sin_affinity: string | null }

/** 수감자별 E.G.O 등급 칸. 인격을 편성하지 않은 수감자는 흐리게 보인다. */
export function FormationEgoGrid({ sinners, egos, onEgoClick, noIdentityLabel }: {
  /** 편성 순서대로: id, 표시 이름, 인격 편성 여부 */
  sinners: { id: string; name: string; filled: boolean }[]
  /** 수감자 id → 등급 → E.G.O */
  egos: Record<string, Record<string, FormationEgo | undefined>>
  onEgoClick: (egoId: string) => void
  noIdentityLabel: string
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {sinners.map(sinner => {
        const byGrade = egos[sinner.id] ?? {}
        return (
          <li key={sinner.id} className={`min-w-0 overflow-hidden rounded border border-[#241c14] bg-[#17120c] ${sinner.filled ? '' : 'opacity-50'}`}>
            <div className="flex items-center gap-2 border-b border-[#241c14] px-2.5 py-2">
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={16} height={16} className="h-4 w-4 opacity-60" />
              <span className={`truncate font-[family-name:var(--font-heading)] text-[0.875rem] ${sinner.filled ? 'text-[#cfc2ad]' : 'text-[#7f7364]'}`}>
                {sinner.name}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-1">
              {GRADE_ORDER.map(grade => {
                const ego = byGrade[grade]
                const gc = GRADE_COLORS[grade] ?? '#555'
                const sinEn = ego?.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                const banner = (
                  <Image
                    src={getEgoGradeBannerUrl(grade)} alt={grade} width={22} height={11} unoptimized
                    className={`h-3 w-auto shrink-0 ${ego ? 'opacity-90' : 'opacity-30'}`}
                  />
                )
                return ego ? (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => onEgoClick(ego.id)}
                    className="flex min-h-8 items-center gap-2 rounded-sm border px-1.5 py-1 text-left transition-[filter] hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8b030]"
                    style={{ background: `${ec}1a`, borderColor: `${ec}55` }}
                  >
                    {banner}
                    <span className="min-w-0 flex-1 text-[0.75rem] font-semibold leading-tight" style={{ color: gc }}>{ego.name}</span>
                  </button>
                ) : (
                  <div key={grade} className="flex min-h-8 items-center gap-2 rounded-sm border border-transparent px-1.5 py-1">
                    {banner}
                    {sinner.filled && <span className="text-[0.75rem] text-[#4a3f31]" aria-hidden="true">—</span>}
                  </div>
                )
              })}
            </div>
            {!sinner.filled && <p className="px-2 pb-2 text-center text-[0.75rem] text-[#7f7364]">{noIdentityLabel}</p>}
          </li>
        )
      })}
    </ul>
  )
}

