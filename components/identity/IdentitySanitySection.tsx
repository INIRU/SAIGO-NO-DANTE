import Image from 'next/image'
import { Identity, STORAGE_BASE } from '@/lib/data/sinners'

interface IdentitySanitySectionProps {
  identity: Identity
}

export default function IdentitySanitySection({ identity }: IdentitySanitySectionProps) {
  if (!identity.panic_type && !identity.sanity_increase && !identity.sanity_decrease) {
    return null
  }

  return (
    <div className="card p-6">
      <h2
        className="font-serif font-light mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        정신력
      </h2>

      <div className="space-y-4">
        {/* 패닉 유형 */}
        {identity.panic_type && (
          <div
            className="p-3 rounded"
            style={{
              background: 'rgba(180,50,50,0.08)',
              border: '1px solid rgba(180,50,50,0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Image
                src={`${STORAGE_BASE}/icons/stats/panic.webp`}
                alt=""
                width={18}
                height={18}
                style={{ filter: 'drop-shadow(0 0 3px rgba(180,50,50,0.5))' }}
              />
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(180,50,50,0.15)', color: '#c05050', border: '1px solid rgba(180,50,50,0.3)' }}>
                패닉 유형
              </span>
              <span className="font-semibold" style={{ color: '#c05050', fontSize: '0.8125rem' }}>
                {identity.panic_type}
              </span>
            </div>
            {identity.panic_description && (
              <p style={{ color: '#aaa', fontSize: '0.6875rem', lineHeight: 1.6, paddingLeft: '26px' }}>
                {identity.panic_description}
              </p>
            )}
          </div>
        )}

        {/* 정신력 증가 조건 */}
        {identity.sanity_increase && (
          <div
            className="p-3 rounded"
            style={{
              background: 'rgba(80,160,100,0.08)',
              border: '1px solid rgba(80,160,100,0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#50a064',
                  filter: 'drop-shadow(0 0 3px rgba(80,160,100,0.4))',
                }}
              >
                +
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(80,160,100,0.15)', color: '#50a064', border: '1px solid rgba(80,160,100,0.3)' }}>
                정신력 증가 조건
              </span>
            </div>
            <div style={{ color: '#aaa', fontSize: '0.6875rem', lineHeight: 1.8, whiteSpace: 'pre-line', paddingLeft: '26px' }}>
              {identity.sanity_increase}
            </div>
          </div>
        )}

        {/* 정신력 감소 조건 */}
        {identity.sanity_decrease && (
          <div
            className="p-3 rounded"
            style={{
              background: 'rgba(100,130,200,0.08)',
              border: '1px solid rgba(100,130,200,0.25)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#6482c8',
                  filter: 'drop-shadow(0 0 3px rgba(100,130,200,0.4))',
                }}
              >
                -
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(100,130,200,0.15)', color: '#6482c8', border: '1px solid rgba(100,130,200,0.3)' }}>
                정신력 감소 조건
              </span>
            </div>
            <div style={{ color: '#aaa', fontSize: '0.6875rem', lineHeight: 1.8, whiteSpace: 'pre-line', paddingLeft: '26px' }}>
              {identity.sanity_decrease}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
