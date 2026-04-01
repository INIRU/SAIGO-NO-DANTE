import Skeleton from '@/components/ui/Skeleton'

interface PageLoadingSkeletonProps {
  /** Title skeleton width (default: '10rem') */
  titleWidth?: string
  /** Number of skeleton cards (default: 12) */
  count?: number
  /** Card height (default: '10rem') */
  cardHeight?: string
  /** Grid columns (default: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4') */
  gridCols?: string
  /** Show filter bar skeletons (default: false) */
  showFilters?: boolean
  /** Number of filter skeletons (default: 3) */
  filterCount?: number
}

export default function PageLoadingSkeleton({
  titleWidth = '10rem',
  count = 12,
  cardHeight = '10rem',
  gridCols = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  showFilters = false,
  filterCount = 3,
}: PageLoadingSkeletonProps) {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <Skeleton style={{ width: titleWidth, height: '2rem', marginBottom: '1.5rem' }} />
        {showFilters && (
          <div className="flex gap-2 mb-6">
            {Array.from({ length: filterCount }, (_, i) => (
              <Skeleton key={i} style={{ width: '5rem', height: '2.25rem', borderRadius: '0.375rem' }} />
            ))}
          </div>
        )}
        <div className={`grid ${gridCols} gap-4`}>
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} style={{ height: cardHeight, borderRadius: '0.5rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
