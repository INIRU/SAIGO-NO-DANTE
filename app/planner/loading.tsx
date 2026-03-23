export default function PlannerLoading() {
  return (
    <div className="min-h-screen pt-24 pb-16" style={{ background: '#0d0b08' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div style={{ height: '2rem', width: '12rem', background: '#1a1510', borderRadius: '0.375rem', marginBottom: '1.5rem' }} />
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: '2.25rem', width: '6rem', background: '#1a1510', borderRadius: '0.5rem' }} />
          ))}
        </div>
        <div className="flex mb-6" style={{ borderBottom: '1px solid #222' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: '2.5rem', width: '5rem', background: '#1a1510', margin: '0 0.125rem' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: '2/3', background: '#1a1510', borderRadius: '0.25rem' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
