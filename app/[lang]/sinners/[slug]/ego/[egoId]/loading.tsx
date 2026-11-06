import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import styles from '@/app/[lang]/sinners/[slug]/ego/[egoId]/_components/EGODetail.module.css'

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className={styles.infoRow}><SkeletonLine w={label} h="0.75rem" className="mb-2.5" />{children}</div>

/** E.G.O 상세: 실제 페이지 모듈 클래스로 경로·이름·원형 아트·기본 정보·스킬 패널 자리를 그대로 잡는다. */
export default function Loading() {
  return <SkeletonPage className={styles.page}>
    <div className={styles.breadcrumb}><SkeletonLine w="3.5rem" h="0.75rem" /><SkeletonLine w="1.5rem" h="0.75rem" /><SkeletonLine w="4rem" h="0.75rem" /></div>
    <div className={styles.hero}>
      <div className={styles.portrait}>
        <div className="flex items-center gap-3"><Skeleton className="h-10 w-[12rem] sm:w-[15rem]" /><Skeleton className="h-5 w-10" /></div>
        <SkeletonLine w="2rem" h="0.8rem" className="mt-2" />
        <div className={styles.artwork}><Skeleton className="h-full w-full !rounded-full" /></div>
        <SkeletonLine w="6rem" h="0.8rem" className="mx-auto my-4" />
      </div>
      <div className={styles.info}>
        <div className={styles.sectionHeading}><Skeleton className="h-[1.625rem] w-[5.5rem]" /><SkeletonCircle size="1.5rem" /></div>
        <Row label="4rem"><div className="flex flex-wrap gap-2">{['5.5rem', '5.5rem', '3rem'].map((w, i) => <Skeleton key={i} line className="h-[2.1rem]" style={{ width: w }} />)}</div></Row>
        <Row label="2rem"><div className="flex gap-6">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-7 w-12" />)}</div></Row>
        <Row label="3rem"><div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, i) => <div key={i} className="flex flex-col items-center gap-1.5"><SkeletonCircle size="1.5rem" /><SkeletonLine w="1.6rem" h="0.65rem" /></div>)}</div></Row>
      </div>
    </div>
    <div className={styles.combat}>
      <div className={styles.sectionHeading}><Skeleton raised className="h-[1.625rem] w-[5rem]" /><div className="flex gap-1">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} raised className="h-9 w-10" />)}</div></div>
      {Array.from({ length: 2 }, (_, i) => <div key={i} className="flex gap-4 py-5">
        <SkeletonCircle size="4.5rem" raised />
        <div className="min-w-0 flex-1 space-y-2"><Skeleton raised className="h-6 w-[9rem]" /><SkeletonLine w="6rem" h="0.8rem" raised /><SkeletonLine w="min(28rem, 95%)" h="0.8rem" raised /><SkeletonLine w="min(22rem, 80%)" h="0.8rem" raised /></div>
      </div>)}
    </div>
  </SkeletonPage>
}
