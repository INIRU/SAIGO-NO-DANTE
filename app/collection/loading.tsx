import PageLoadingSkeleton from '@/components/ui/PageLoadingSkeleton'
export default function Loading() {
  return (
    <PageLoadingSkeleton
      showFilters
      filterCount={12}
      count={18}
      cardHeight="6rem"
      gridCols="grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
    />
  )
}
