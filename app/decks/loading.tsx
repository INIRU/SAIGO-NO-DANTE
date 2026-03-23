import Skeleton from '@/components/ui/Skeleton'
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <Skeleton style={{ width: '8rem', height: '2rem', marginBottom: '1.5rem' }} />
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} style={{ height: '8rem', borderRadius: '0.75rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
