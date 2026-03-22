function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: '#1a1510', ...style }} />
}
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <Skeleton style={{ width: '10rem', height: '2rem', marginBottom: '1.5rem' }} />
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} style={{ width: '5rem', height: '2.25rem', borderRadius: '0.375rem' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} style={{ height: '10rem', borderRadius: '0.5rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
