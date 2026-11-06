import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import { META_PERIODS, META_SOURCES } from '@/lib/meta/types'
import styles from '@/styles/components/MetaAnalysis.module.css'

/** The overview tab's shape: two donuts with their legends, the ranking, and the sinner grid. */
function Body() {
  return <div className={styles.analysis} data-meta-skeleton="body">
    <div className={styles.overview}>
      <div className={styles.overviewHead}><SkeletonLine w="6rem" h="1.25rem" /><SkeletonLine w="18rem" h="0.75rem" /></div>
      <div className={styles.overviewGrid}>
        {[0, 1].map(i => <div key={i} className={styles.chartBlock}><SkeletonLine w="5rem" h="0.9375rem" />
          <div className={styles.donut}><SkeletonCircle size="8.75rem" raised /><div className={styles.legend}>{[0, 1, 2, 3].map(j => <SkeletonLine key={j} h="1.5rem" raised className="my-1" />)}</div></div>
        </div>)}
        <div className={styles.chartBlock}><SkeletonLine w="7rem" h="0.9375rem" />{[0, 1, 2, 3, 4, 5].map(j => <SkeletonLine key={j} h="2.5rem" raised className="my-0.5" />)}</div>
      </div>
    </div>
    <div className={styles.panel}><div className={styles.sectionHead}><SkeletonLine w="9rem" h="1rem" /></div>
      <div className={styles.sinnerGrid}>{Array.from({ length: 12 }, (_, i) => <SkeletonLine key={i} h="9.5rem" raised />)}</div>
    </div>
  </div>
}

/** While the client loads a scope it has nothing for: the real toolbar stays, this takes the rest. */
export function MetaBodySkeleton() {
  return <SkeletonPage><Body /></SkeletonPage>
}

/** The whole analysis page under its header, while the server reads the data: toolbar, summary, view tabs and body. */
export default function MetaSkeleton() {
  return <SkeletonPage>
    <div className={styles.toolbar} data-meta-skeleton="toolbar">
      <div className={styles.boneTabs}>{META_SOURCES.map(key => <SkeletonLine key={key} w="3.5rem" h="0.9375rem" raised />)}</div>
      <div className={styles.toolbarEnd}>
        <div className={styles.periods}>{META_PERIODS.map(key => <Skeleton key={key} className={styles.period} style={{ width: '4rem' }} raised />)}</div>
        <Skeleton className={styles.filterToggle} style={{ width: '4.75rem' }} raised />
      </div>
    </div>
    <div className={styles.summaryBar} data-meta-skeleton="summary">
      <div className={styles.boneStats}>{[0, 1, 2].map(i => <div key={i}><SkeletonLine w="2.5rem" h="1.625rem" raised /><SkeletonLine w="2.5rem" h="0.6875rem" raised /></div>)}</div>
      <div className={styles.overviewNotes}><SkeletonLine w="3.5rem" h="0.75rem" raised className={styles.boneNote} /></div>
    </div>
    <div className={`${styles.views} ${styles.boneViews}`} data-meta-skeleton="views">
      <div className={styles.boneTabs}>{[0, 1, 2].map(i => <SkeletonLine key={i} w="4rem" h="0.9375rem" />)}</div>
    </div>
    <Body />
  </SkeletonPage>
}
