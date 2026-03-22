function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: '#1a1510', ...style }} />
}
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <Skeleton style={{ width: '10rem', height: '2rem', marginBottom: '1.5rem' }} />
        <Skeleton style={{ width: '100%', height: '2.5rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 16 }, (_, i) => (
            <Skeleton key={i} style={{ height: '5rem', borderRadius: '0.5rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
