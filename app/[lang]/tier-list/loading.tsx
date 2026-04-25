import { TIER_COLORS, TIER_SCORE_LABELS, TIERS } from '@/lib/tier-list/tierModel'

export default function Loading() {
  return (
    <div style={{ background: 'var(--bg-deep)', minHeight: '100dvh' }}>
      <style>{`
        @media (max-width: 47.999rem) {
          .tier-loading-header {
            padding: 4.75rem 1rem 1rem !important;
          }
          .tier-loading-shell {
            padding-left: 0.875rem !important;
            padding-right: 0.875rem !important;
            padding-bottom: 3rem !important;
          }
          .tier-loading-tabs {
            margin-bottom: 1rem !important;
          }
          .tier-loading-row-stack {
            gap: 0.875rem !important;
          }
          .tier-loading-row {
            grid-template-columns: minmax(0, 1fr) !important;
            row-gap: 0.5rem !important;
          }
          .tier-loading-label-rail {
            flex-direction: row !important;
            align-items: center !important;
            gap: 0.375rem !important;
          }
          .tier-loading-label-block {
            width: auto !important;
            min-width: 4.5rem !important;
            min-height: 2rem !important;
            flex-direction: row !important;
            gap: 0.375rem !important;
            padding: 0 0.625rem !important;
          }
          .tier-loading-label-mark {
            font-size: 0.9375rem !important;
          }
          .tier-loading-label-sub {
            font-size: 0.6875rem !important;
            margin-top: 0 !important;
          }
          .tier-loading-label-line {
            display: block !important;
            width: min(8rem, 38vw) !important;
            height: 0.0625rem !important;
            min-height: 0 !important;
            flex: 0 1 8rem !important;
          }
          .tier-loading-rail-line {
            display: none !important;
          }
          .tier-loading-na-controls {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 0.5rem !important;
            min-height: 0 !important;
            margin: 0 0 0.75rem !important;
            padding: 0.5rem !important;
          }
          .tier-loading-na-controls > div:first-child {
            grid-column: 1 / -1 !important;
          }
          .tier-loading-card-grid {
            width: 100% !important;
            grid-template-columns: minmax(0, 6.25rem) minmax(0, 6.25rem) minmax(0, 6.25rem) !important;
            justify-content: center !important;
            gap: 1rem 0.625rem !important;
            padding: 0.25rem 0 0.875rem !important;
          }
          .tier-loading-card {
            height: auto !important;
            aspect-ratio: 2 / 3 !important;
          }
        }
        @media (max-width: 22.5rem) {
          .tier-loading-card-grid {
            grid-template-columns: minmax(0, 6.25rem) minmax(0, 6.25rem) !important;
          }
          .tier-loading-na-controls {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .tier-loading-na-controls > div:first-child {
            grid-column: auto !important;
          }
        }
      `}</style>
      <div className="tier-loading-header max-w-5xl mx-auto text-center" style={{ padding: '5.75rem 1.25rem 1.375rem' }}>
        <div className="mx-auto rounded" style={{ width: '5.75rem', height: '0.625rem', background: 'rgba(200,144,10,0.14)', marginBottom: '0.5rem' }} />
        <div className="mx-auto rounded" style={{ width: '10.5rem', height: '2rem', background: '#2a2318' }} />
        <div className="mx-auto rounded" style={{ width: '18rem', maxWidth: '75%', height: '0.8125rem', background: '#1a1510', marginTop: '0.5rem' }} />
        <div className="mx-auto" style={{ width: '7rem', height: '0.0625rem', background: 'rgba(200,144,10,0.32)', marginTop: '0.875rem' }} />
      </div>

      <div className="tier-loading-shell max-w-6xl mx-auto px-4 md:px-6 pb-16 animate-pulse">
        <div
          className="tier-loading-tabs mx-auto grid w-full max-w-lg grid-cols-4"
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

        <div className="tier-loading-row-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          {TIERS.map((tier, tierIndex) => (
            <section
              key={tier}
              className="tier-loading-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(3.75rem, 4.5rem) minmax(0, 1fr)',
                columnGap: '1rem',
                alignItems: 'start',
              }}
            >
              <div className="tier-loading-label-rail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                <div
                  className="tier-loading-label-block"
                  style={{
                    width: '100%',
                    minHeight: tier === 'N/A' ? '3.875rem' : '3.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '0.375rem',
                    background: `${TIER_COLORS[tier]}44`,
                  }}
                >
                  <span className="tier-loading-label-mark" style={{ color: '#f0dfba', fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>
                    {tier}
                  </span>
                  <span className="tier-loading-label-sub" style={{ color: '#d8c99b', fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.25, marginTop: '0.1875rem' }}>
                    {TIER_SCORE_LABELS[tier]}
                  </span>
                </div>
                <div className="tier-loading-label-line" aria-hidden="true" style={{ display: 'none', background: `${TIER_COLORS[tier]}66` }} />
                <div
                  className="tier-loading-rail-line"
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
                    className="tier-loading-na-controls grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_7rem_8.5rem]"
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
                  className="tier-loading-card-grid"
                  style={{
                    display: 'grid',
                    width: 'min(100%, 64rem)',
                    margin: '0 auto',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 8.5rem), 9.25rem))',
                    justifyContent: 'start',
                    alignItems: 'start',
                    gap: '1.375rem 1.125rem',
                    padding: '0.25rem 0.25rem 0.875rem',
                    overflow: 'visible',
                  }}
                >
                  {Array.from({ length: tierIndex < 2 ? 4 : tier === 'N/A' ? 8 : 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="tier-loading-card"
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
