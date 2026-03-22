function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded ${className}`} style={{ background: '#1a1510', ...style }} />
}
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <Skeleton style={{ width: '16rem', height: '1rem', marginBottom: '2rem' }} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton style={{ height: '24rem', borderRadius: '0.75rem' }} />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton style={{ height: '3rem', borderRadius: '0.5rem' }} />
            <Skeleton style={{ height: '8rem', borderRadius: '0.5rem' }} />
            <Skeleton style={{ height: '12rem', borderRadius: '0.5rem' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
