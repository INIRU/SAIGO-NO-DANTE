const TIERS = ['S+', 'S', 'A', 'B', 'C', 'N/A'] as const

const TIER_COLORS: Record<string, string> = {
  'S+': '#ff5050',
  S: '#ff8c50',
  A: '#f0c040',
  B: '#70d070',
  C: '#50b0e0',
  'N/A': '#8a7855',
}

export default function Loading() {
  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh' }}>
      <div className="max-w-5xl mx-auto text-center" style={{ padding: '5.75rem 1.25rem 1.375rem' }}>
        <div className="mx-auto rounded" style={{ width: '5.75rem', height: '0.625rem', background: 'rgba(200,144,10,0.14)', marginBottom: '0.5rem' }} />
        <div className="mx-auto rounded" style={{ width: '10.5rem', height: '2rem', background: '#2a2318' }} />
        <div className="mx-auto rounded" style={{ width: '18rem', maxWidth: '75%', height: '0.8125rem', background: '#1a1510', marginTop: '0.5rem' }} />
        <div className="mx-auto" style={{ width: '7rem', height: '0.0625rem', background: 'rgba(200,144,10,0.32)', marginTop: '0.875rem' }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-16 animate-pulse">
        <div
          className="mx-auto grid w-full max-w-lg grid-cols-4"
          style={{
            gap: '0.25rem',
            padding: '0.25rem',
            background: '#14100c',
            border: '1px solid rgba(200,144,10,0.22)',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{
                minHeight: '2.25rem',
                borderRadius: '0.375rem',
                background: index === 0 ? 'rgba(200,144,10,0.16)' : '#0d0b08',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          {TIERS.map((tier, tierIndex) => (
            <section
              key={tier}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(3.75rem, 4.5rem) minmax(0, 1fr)',
                columnGap: '1rem',
                alignItems: 'start',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '100%',
                    minHeight: tier === 'N/A' ? '3.875rem' : '3.5rem',
                    borderRadius: '0.375rem',
                    background: `${TIER_COLORS[tier]}44`,
                  }}
                />
                <div className="mx-auto rounded" style={{ width: '3.25rem', height: '0.6875rem', background: '#1a1510' }} />
                <div
                  style={{
                    width: '0.0625rem',
                    minHeight: '4rem',
                    alignSelf: 'center',
                    background: `${TIER_COLORS[tier]}33`,
                  }}
                />
              </div>

              <div>
                {tier === 'N/A' && (
                  <div
                    className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_7rem_8.5rem]"
                    style={{
                      margin: '0 0.25rem 0.875rem',
                      minHeight: '3.875rem',
                      padding: '0.625rem',
                      background: '#14100c',
                      border: '1px solid rgba(200,144,10,0.18)',
                      borderRadius: '0.5rem',
                    }}
                  >
                    <div style={{ height: '2.25rem', borderRadius: '0.375rem', background: '#0d0b08' }} />
                    <div style={{ height: '2.25rem', borderRadius: '0.375rem', background: '#0d0b08' }} />
                    <div style={{ height: '2.25rem', borderRadius: '0.375rem', background: '#0d0b08' }} />
                    <div style={{ height: '2.25rem', borderRadius: '0.375rem', background: '#0d0b08' }} />
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 8.75rem), 9.75rem))',
                    justifyContent: 'center',
                    alignItems: 'start',
                    gap: '1.375rem 1.125rem',
                    padding: '0.25rem 0.25rem 0.875rem',
                    overflow: 'visible',
                  }}
                >
                  {Array.from({ length: tierIndex < 2 ? 4 : tier === 'N/A' ? 8 : 5 }).map((_, index) => (
                    <div
                      key={index}
                      style={{
                        height: '13.25rem',
                        borderRadius: '0.375rem',
                        background: '#1a1510',
                        border: '1px solid rgba(200,144,10,0.08)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
