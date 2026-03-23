import Skeleton from '@/components/ui/Skeleton'
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <Skeleton style={{ width: '12rem', height: '2rem', marginBottom: '2rem' }} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} style={{ height: '14rem', borderRadius: '0.5rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
