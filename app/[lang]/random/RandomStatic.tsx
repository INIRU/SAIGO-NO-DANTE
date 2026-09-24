import Image from 'next/image'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import type { Sinner } from '@/lib/types/index'

type Props = {
  sinners: Sinner[]
}

/**
 * Server-rendered ghost grid skeleton.
 * Painted in initial HTML — no client JS needed — so it becomes the LCP element.
 */
export default function RandomStatic({ sinners }: Props) {
  return (
    <>
      {/* Ghost card grid — 12 sinners, visible immediately from server HTML */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-[0.75rem] gap-y-[1rem]">
        {sinners.map((sinner, idx) => (
          <div
            key={sinner.id}
            className="animate-fade-in"
            style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
          >
            <div
              className="w-full rounded-[0.375rem] overflow-hidden relative animate-ghost-pulse"
              style={{
                aspectRatio: '2/3',
                background: 'linear-gradient(160deg, #1a1510 0%, #0d0a06 60%, #100c08 100%)',
                border: '1.5px dashed rgba(42,32,21,0.4)',
                animationDelay: `${idx * 150}ms`,
              }}
            >
              {/* Sinner logo watermark */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src={getSinnerLogoUrl(sinner.id)}
                  alt=""
                  width={48}
                  height={48}
                  style={{ width: '3rem', height: '3rem', opacity: 0.08, filter: 'grayscale(1)' }}
                />
              </div>
              {/* Corner ornaments */}
              <div
                className="absolute top-0 left-0 w-[1.25rem] h-[1.25rem]"
                style={{
                  borderTop: '1px solid rgba(138,96,16,0.12)',
                  borderLeft: '1px solid rgba(138,96,16,0.12)',
                }}
              />
              <div
                className="absolute top-0 right-0 w-[1.25rem] h-[1.25rem]"
                style={{
                  borderTop: '1px solid rgba(138,96,16,0.08)',
                  borderRight: '1px solid rgba(138,96,16,0.08)',
                }}
              />
              <div
                className="absolute bottom-0 left-0 w-[1.25rem] h-[1.25rem]"
                style={{
                  borderBottom: '1px solid rgba(138,96,16,0.08)',
                  borderLeft: '1px solid rgba(138,96,16,0.08)',
                }}
              />
              <div
                className="absolute bottom-0 right-0 w-[1.25rem] h-[1.25rem]"
                style={{
                  borderBottom: '1px solid rgba(138,96,16,0.12)',
                  borderRight: '1px solid rgba(138,96,16,0.12)',
                }}
              />
              {/* Sinner name hint */}
              <div className="absolute bottom-[0.375rem] inset-x-0 flex justify-center">
                <span
                  style={{
                    fontSize: '0.5rem',
                    color: '#2a2015',
                    letterSpacing: '0.08em',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {sinner.name_kr}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
