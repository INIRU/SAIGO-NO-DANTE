import type { CSSProperties, ReactNode } from 'react'
import Skeleton, { SkeletonCircle, SkeletonLine } from '@/components/ui/Skeleton'
import boardStyles from './DetailPageSkeleton.module.css'

/** Shared by the plan and deck detail pages: both hero modules expose the same class names. */
type HeroStyles = { readonly [key: string]: string }

const GOLD = 'rgba(200,144,10,0.35)'

/** 6×2 IdentityFrameCard board, same grid as FormationBoard (3 / 4 / 6 columns, card 290:428). */
export function FormationBoardSkeleton({ className = '' }: { className?: string }) {
  return <div className={`${boardStyles.grid} ${className}`}>
    {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '290 / 428' }} />)}
  </div>
}

/** Section title row (SectionHead): 1.375/1.5rem heading, optional right meta. */
export function SectionHeadSkeleton({ w = '6rem', meta }: { w?: string; meta?: string }) {
  return <div className="mb-5 flex items-end justify-between gap-4">
    <div className="flex h-[2.06rem] items-center"><Skeleton className="h-[1.375rem]" style={{ width: w }} /></div>
    {meta && <SkeletonLine w={meta} h="0.875rem" className="mb-1.5 hidden sm:block" />}
  </div>
}

/** DeckInsights: keyword distribution + attack/sin summary on the left, passive panel on the right (stacked on mobile). */
export function DeckInsightsSkeleton() {
  return <div className="mt-8 grid gap-8 border-t border-[#241c14] pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
    <div>
      <SkeletonLine w="5rem" h="1.0625rem" className="mb-4" />
      <div className="space-y-3">{[100, 62, 24, 24].map((p, i) => <div key={i}>
        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_1rem] items-center gap-3"><SkeletonLine w="3rem" h="0.8125rem" /><Skeleton className="h-1.5" style={{ width: `${p}%` }} /><SkeletonLine w="0.6rem" h="0.8125rem" /></div>
        {i < 2 && <div className="ml-[5.25rem] mt-1.5 flex gap-1">{Array.from({ length: i ? 5 : 9 }, (_, j) => <Skeleton key={j} className="h-6 w-6" />)}</div>}
      </div>)}</div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5"><SkeletonLine w="4.5rem" h="1rem" />{[70, 20, 35].map((p, i) => <Skeleton key={i} className="h-1.5" style={{ width: `${p}%` }} />)}</div>
        <div><SkeletonLine w="4.5rem" h="1rem" /><div className="mt-2.5 flex flex-wrap gap-1.5">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} line className="h-6 w-[3.6rem]" />)}</div></div>
      </div>
    </div>
    <div>
      <div className="mb-4 flex items-center justify-between"><SkeletonLine w="3.5rem" h="1.0625rem" /><Skeleton line className="h-8 w-[6.5rem]" /></div>
      <div className="space-y-2">{['40%', '95%', '88%', '70%', '92%', '60%'].map((w, i) => <SkeletonLine key={i} w={w} h="0.8125rem" />)}</div>
    </div>
  </div>
}

/** Back link, hero (keywords, title, author, facts, command row), section nav. Children are the sections. */
export default function DetailPageSkeleton({ s, facts, actions, nav, children }: {
  s: HeroStyles
  facts: number
  /** Secondary button widths on wide screens; the gold primary (assist / fork) follows, pushed right. */
  actions: string[]
  /** Section nav label widths; the first is active. */
  nav: string[]
  children: ReactNode
}) {
  return <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
    <div className="mb-5 flex min-h-[44px] items-center gap-2 px-1"><Skeleton className="h-4 w-4" /><SkeletonLine w="5.5rem" h="0.9375rem" /></div>
    <div className={s.hero}>
      <div className={s.identity}>
        <div className="mb-3 flex min-h-8 items-center gap-4">{['2.5rem', '2.5rem'].map((w, i) => <div key={i} className="flex items-center gap-1.5"><SkeletonCircle size="1.75rem" /><SkeletonLine w={w} h="1rem" /></div>)}</div>
        <div className={s.title}>&#8203;<Skeleton className="inline-block h-[0.8em] w-[6em] align-middle" /></div>
      </div>
      <div className={`${s.author} flex items-center gap-3`}>
        <SkeletonCircle size="2.75rem" />
        <div className="space-y-1.5"><SkeletonLine w="7rem" h="1rem" /><SkeletonLine w="3rem" h="0.8125rem" /></div>
      </div>
      <div className={s.facts}>{Array.from({ length: facts }, (_, i) => <div key={i} className={s.fact}>
        <div className="flex h-[1.06rem] items-center"><SkeletonLine w="2.25rem" h="0.75rem" /></div>
        <Skeleton className="mt-0.5 h-[1.75rem]" style={{ width: i === 0 ? '3rem' : '2rem' }} />
      </div>)}</div>
      {/* Own classes: the plan module sets `.actions > div { display: contents }` for PlanActions' wrapper. */}
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap" style={{ gridArea: 'actions' }}>
        {actions.map((w, i) => <Skeleton key={i} line className="h-11 sm:w-[var(--w)]" style={{ '--w': w } as CSSProperties} />)}
        <Skeleton className="col-span-2 h-[3.25rem] sm:ml-auto sm:h-12 sm:w-[15rem]" style={{ background: GOLD }} />
      </div>
    </div>
    <div className={s.sectionNav}>
      <div className="flex gap-1 overflow-hidden">{nav.map((w, i) => <div key={i} className={`-mb-px flex min-h-12 shrink-0 items-center border-b-2 px-3 ${i === 0 ? 'border-[var(--gold)] pl-0' : 'border-transparent'}`}><SkeletonLine w={w} h="0.9375rem" /></div>)}</div>
    </div>
    {children}
  </div>
}
