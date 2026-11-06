import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import hero from '@/components/sinners/SinnerHero.module.css'
import detail from '@/styles/components/SinnerDetail.module.css'

/** The sinner page's own boxes: the hero (SinnerHero.module.css), then the tabs, search, filters and the card grid. */
export default function Loading() {
  return <SkeletonPage className="min-h-[100dvh] pb-16">
    <section className={hero.hero}>
      <div className={hero.inner}>
        <div className="flex min-h-11 items-center gap-2"><Skeleton className="h-4 w-4" /><SkeletonLine w="4.5rem" h="0.8rem" /></div>
        <div className={hero.body}>
          <Skeleton className={hero.plate} style={{ aspectRatio: '389 / 1023' }} />
          <div className={`${hero.text} w-full space-y-3`}>
            <Skeleton className="h-[clamp(2.5rem,7vw,4rem)] w-[min(18rem,70%)]" />
            <SkeletonLine w="6rem" h="0.8rem" />
            <SkeletonLine w="100%" h="0.9rem" />
            <SkeletonLine w="60%" h="0.9rem" />
          </div>
        </div>
      </div>
    </section>
    <div className="mx-auto mt-6 max-w-[90rem] px-5 sm:mt-8 sm:px-8">
      <div className="mb-4 flex gap-7 border-b border-[#2e2417]">{['2.6rem', '3.2rem'].map((w, i) => <div key={i} className={`-mb-px flex min-h-11 items-center border-b-2 ${i === 0 ? 'border-[var(--gold)]' : 'border-transparent'}`}><SkeletonLine w={w} h="1rem" /></div>)}</div>
      <Skeleton line className="mb-3 h-11 w-full" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton line className="h-9 w-[7.5rem]" />
        <div className="flex gap-2"><Skeleton line className="h-9 w-[3.5rem]" /><Skeleton line className="h-9 w-[3.5rem]" /><Skeleton line className="h-9 w-[4.5rem]" /></div>
      </div>
      <div className={`${detail.identityGrid} mt-4`}>{Array.from({ length: 16 }, (_, i) => <Skeleton key={i} line style={{ aspectRatio: '290 / 428' }} />)}</div>
    </div>
  </SkeletonPage>
}
