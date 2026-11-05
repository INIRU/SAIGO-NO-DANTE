import { HtmlFlag } from '@/hooks/useHtmlFlag'
import Skeleton, { SkeletonLine } from '@/components/ui/Skeleton'
import { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import page from '@/app/[lang]/friends/_components/Friends.module.css'
import strips from './SupportStrips.module.css'

/** Empty strips drawn with the real strip classes, so the row has the size the loaded one will have. */
export function StripsSkeleton({ count = 12 }: { count?: number }) {
  return <div className={`${strips.strips} ${count < 12 ? strips.few : ''}`} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <div key={index} className={`${strips.strip} ${strips.empty}`}>
      <span className={strips.cut} />
      <svg className={strips.frame} viewBox="0 0 197 982" preserveAspectRatio="none"><polygon points="0.5,49.5 196.5,0.5 196.5,932.5 0.5,981.5" /></svg>
    </div>)}
  </div>
}

/** Posts of the list while it loads: the same grid, header row and strips as the real posts. */
export function PostsSkeleton({ kind }: { kind: 'support' | 'want' }) {
  return kind === 'support'
    ? <section className={page.list}>
      {Array.from({ length: 4 }, (_, index) => <article key={index} className={page.post}>
        <header><SkeletonLine w="6.5rem" h="1rem" /><SkeletonLine w="3.5rem" h="0.8rem" /><span className={page.codeBox}><SkeletonLine w="10.5rem" h="1.5rem" /></span></header>
        <StripsSkeleton />
      </article>)}
    </section>
    : <section className={page.wants}>
      {Array.from({ length: 3 }, (_, index) => <article key={index} className={page.want}>
        <StripsSkeleton count={3} />
        <div className={page.info}><SkeletonLine w="4.5rem" h="1.6rem" /></div>
      </article>)}
    </section>
}

/** The board page before its client code runs: title, tab bar and posts in their places. */
export function FriendsSkeleton() {
  return <main className={page.page}>
    <PageHeaderSkeleton titleWidth="7rem" description={false} />
    <div className={page.bar}><Skeleton style={{ width: '13.5rem', height: '2.5rem' }} /><Skeleton style={{ width: '8.5rem', height: '2.5rem' }} /></div>
    <PostsSkeleton kind="support" />
  </main>
}

/** The writing page before its client code runs. */
export function ComposeSkeleton({ kind }: { kind: 'support' | 'want' }) {
  return <main className={`${page.page} ${page.compose}`}>
    <HtmlFlag name="with-friend-compose" />
    <SkeletonLine w="5rem" h="0.85rem" className="mb-[0.9rem]" />
    <PageHeaderSkeleton titleWidth="10rem" description={false} />
    <section className={page.editor}>
      <div className={page.fields}><Skeleton raised style={{ width: '15rem', height: '3.6rem' }} /><Skeleton raised style={{ width: '17rem', height: '3.6rem' }} /></div>
      <div className={page.stage}><StripsSkeleton count={kind === 'support' ? 12 : 3} /></div>
    </section>
  </main>
}
