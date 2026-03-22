function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: '#1a1510', ...style }} />
}
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <Skeleton style={{ width: '14rem', height: '2rem', marginBottom: '1rem' }} />
        <Skeleton style={{ width: '8rem', height: '1rem', marginBottom: '2rem' }} />
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} style={{ height: '10rem', borderRadius: '0.5rem' }} />
          ))}
        </div>
        <Skeleton style={{ height: '8rem', borderRadius: '0.75rem' }} />
      </div>
    </div>
  )
}
