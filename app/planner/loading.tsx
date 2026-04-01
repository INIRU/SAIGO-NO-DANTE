import PageLoadingSkeleton from '@/components/ui/PageLoadingSkeleton'
export default function Loading() {
  return (
    <PageLoadingSkeleton
      titleWidth="12rem"
      showFilters
      filterCount={4}
      gridCols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
    />
  )
}
