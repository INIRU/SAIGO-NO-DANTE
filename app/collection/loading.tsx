import Skeleton from '@/components/ui/Skeleton'
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <Skeleton style={{ width: '10rem', height: '2rem', marginBottom: '1.5rem' }} />
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} style={{ width: '4rem', height: '2rem', borderRadius: '0.375rem', flexShrink: 0 }} />
          ))}
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 18 }, (_, i) => (
            <Skeleton key={i} style={{ height: '6rem', borderRadius: '0.5rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
