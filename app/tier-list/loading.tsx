function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: '#1a1510', ...style }} />
}
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <Skeleton style={{ width: '10rem', height: '2rem', marginBottom: '1.5rem' }} />
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} style={{ height: '4rem', borderRadius: '0.5rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
