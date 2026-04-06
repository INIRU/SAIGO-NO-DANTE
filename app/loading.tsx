/**
 * Home page loading skeleton.
 * Shown by Next.js while the root layout's async Server Component suspends.
 * Matches the hero section layout so there is no layout shift on first paint.
 */
export default function HomeLoading() {
  return (
    <div
      className="relative overflow-hidden flex"
      style={{ minHeight: '100dvh', background: 'var(--bg-deep)' }}
    >
      {/* Simulated image placeholder — right 62% column */}
      <div
        className="absolute inset-y-0 right-0 hidden md:block"
        style={{
          width: '62%',
          background: 'linear-gradient(135deg, rgba(200,144,10,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Text column skeleton */}
      <div className="relative z-10 flex flex-col justify-center px-6 md:px-16 lg:px-24 max-w-xl w-full">
        {/* Logo + title row */}
        <div className="flex items-center gap-4 mb-2">
          <div
            className="rounded animate-pulse"
            style={{ width: '2.75rem', height: '3.375rem', background: 'rgba(200,144,10,0.08)', flexShrink: 0 }}
          />
          <div
            className="rounded animate-pulse"
            style={{ width: '16rem', height: '2.5rem', background: 'rgba(200,144,10,0.08)' }}
          />
        </div>

        {/* Subtitle */}
        <div
          className="rounded animate-pulse mb-6"
          style={{ width: '10rem', height: '1.125rem', background: 'rgba(200,144,10,0.06)' }}
        />

        {/* Identity name badge */}
        <div
          className="rounded animate-pulse mb-8"
          style={{ width: '8rem', height: '1rem', background: 'rgba(200,144,10,0.05)' }}
        />

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3">
          {[7, 5.5, 7, 7.5].map((w, i) => (
            <div
              key={i}
              className="rounded animate-pulse"
              style={{
                width: `${w}rem`,
                height: '2.625rem',
                background: i === 0 ? 'rgba(200,144,10,0.12)' : 'rgba(200,144,10,0.06)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
