'use client'

import type { EgoSlotItem } from '@/components/cards/EgoSlotRows'

type FormationTab<K extends string> = { key: K; label: string; count?: string | null }

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
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-[0.9375rem] transition-colors first:pl-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--gold-light)] motion-reduce:transition-none ${selected
                ? 'border-[var(--gold)] font-semibold text-[var(--text-primary)]'
                : 'border-transparent text-[#9c8b73] hover:text-[var(--text-primary)]'}`}
            >
              {tab.label}
              {tab.count && <span className="font-normal tabular-nums text-[var(--text-muted)]">{tab.count}</span>}
            </button>
          )
        })}
      </div>
      {hint && <p className="pb-2 text-[0.8125rem] text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
}

export type FormationEgo = EgoSlotItem
