import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'

const divider = <div className="h-px bg-[#2e2417]" />
const Tabs = ({ widths }: { widths: string[] }) => <div className="flex gap-7 border-b border-[#2e2417]">{widths.map((w, i) => <div key={i} className={`-mb-px flex min-h-11 items-center border-b-2 ${i === 0 ? 'border-[var(--gold)]' : 'border-transparent'}`}><SkeletonLine w={w} h="1rem" /></div>)}</div>

/** 인격 상세: 경로, 정보/덱 탭, 왼쪽 이름·일러스트 탭·초상, 오른쪽 기본 정보·스탯 패널, 아래 스킬 탭과 스킬 카드. */
export default function Loading() {
  return <SkeletonPage className="min-h-[100dvh] pb-16 pt-24">
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <div className="flex items-center gap-2"><SkeletonLine w="3.5rem" h="0.75rem" /><SkeletonLine w="2rem" h="0.75rem" /><SkeletonLine w="4rem" h="0.75rem" /></div>
      <Tabs widths={['3.6rem', '1.2rem']} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] lg:gap-10">
        <div className="min-w-0">
          <div className="flex items-center gap-3"><SkeletonCircle size="1.75rem" /><Skeleton className="h-9 w-[11rem] sm:w-[13rem]" /></div>
          <SkeletonLine w="2rem" h="0.7rem" className="ml-10 mt-2" />
          <div className="mt-4 grid grid-cols-2 border border-[#2e2417]"><div className="flex h-9 items-center justify-center border-b-2 border-[var(--gold)] bg-[rgba(200,144,10,0.12)]"><SkeletonLine w="3rem" h="0.75rem" /></div><div className="flex h-9 items-center justify-center"><SkeletonLine w="5rem" h="0.75rem" /></div></div>
          <Skeleton className="mx-auto mt-2 w-full max-w-[25rem]" style={{ aspectRatio: '2 / 3' }} />
          <div className="mt-4 flex flex-col items-center gap-3 border-t border-white/10 pt-4">
            <Skeleton className="h-[9rem] w-[6.3rem] sm:h-[11rem] sm:w-[7.7rem]" />
            <SkeletonLine w="80%" h="0.8rem" />
          </div>
        </div>
        <div className="min-w-0 space-y-5">
          <div className="flex items-center justify-between"><Skeleton className="h-7 w-[6rem]" /><Skeleton className="h-6 w-[2.5rem]" /></div>
          <SkeletonLine w="4rem" h="0.75rem" />
          <div className="flex gap-2">{['4rem', '3.6rem', '3.6rem'].map((w, i) => <Skeleton key={i} line className="h-9" style={{ width: w }} />)}</div>
          <SkeletonLine w="5rem" h="0.75rem" />
          <div className="flex gap-6"><SkeletonLine w="5rem" h="0.8rem" /><SkeletonLine w="3rem" h="0.8rem" /></div>
          {divider}
          {['5rem', '5rem', '4rem', '16rem', '12rem'].map((w, i) => <div key={i} className="flex items-center gap-4"><SkeletonLine w="2.5rem" h="0.75rem" /><SkeletonLine w={w} h="0.8rem" /></div>)}
          <Skeleton line className="h-[16rem] w-full" />
        </div>
      </div>
      <div className="flex items-end justify-between border-b border-[#2e2417]"><div className="flex gap-7">{['2.6rem', '3.6rem'].map((w, i) => <div key={i} className={`-mb-px flex min-h-11 items-center border-b-2 ${i === 0 ? 'border-[var(--gold)]' : 'border-transparent'}`}><SkeletonLine w={w} h="1rem" /></div>)}</div><Skeleton line className="mb-1.5 h-8 w-[4.5rem]" /></div>
      <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} line className="h-[6rem] w-full" />)}</div>
    </div>
  </SkeletonPage>
}

