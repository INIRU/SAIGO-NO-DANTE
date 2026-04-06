import Image from 'next/image'
import type { SanityCondition, PanicType } from '@/lib/types'
import { STORAGE_BASE } from '@/lib/constants/game'

interface IdentitySanitySectionProps {
  sanityConditions: SanityCondition[]
  panicInfo?: PanicType | null
}

const BRAIN_URL = `${STORAGE_BASE}/icons/stats/panic.webp`
const BRAIN_LOVE_HATE_URL = `${STORAGE_BASE}/icons/stats/panic_love_hate.webp`
const SANITY_INCREASE_BG = `${STORAGE_BASE}/icons/stats/sanity_increase_bg.webp`
const SANITY_DECREASE_BG = `${STORAGE_BASE}/icons/stats/sanity_decrease_bg.webp`

/** Parse <color=X>text</color> tags and strip <size> tags. */
function parseMarkupTags(text: string): React.ReactNode[] {
  const cleaned = text
    .replace(/<size=\d+%>/g, '')
    .replace(/<\/size>/g, '')

  const parts: React.ReactNode[] = []
  let remaining = cleaned
  let key = 0

  const colorRegex = /<color=([^>]+)>([\s\S]*?)<\/color>/
  let match = colorRegex.exec(remaining)
  while (match) {
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index))
    }
    parts.push(
      <span key={key++} style={{ color: match[1], fontWeight: 600 }}>{match[2]}</span>
    )
    remaining = remaining.slice(match.index + match[0].length)
    match = colorRegex.exec(remaining)
  }
  if (remaining) parts.push(remaining)

  return parts
}

/** Parse sanity text into structured lines: bullet items + sub-lines (parenthesized). */
function renderSanityText(text: string, bulletColor?: string): React.ReactNode {
  const lines = text.split('\n')
  const items: React.ReactNode[] = []

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) return

    const isBullet = trimmed.startsWith('·')
    const isSub = trimmed.startsWith('(')
    const content = isBullet ? trimmed.slice(1) : trimmed

    if (isSub) {
      items.push(
        <div
          key={i}
          style={{
            paddingLeft: '1.25rem',
            color: '#999',
            fontSize: '0.75rem',
            lineHeight: 1.7,
          }}
        >
          {parseMarkupTags(content)}
        </div>
      )
    } else {
      items.push(
        <div
          key={i}
          className="flex gap-2"
          style={{
            lineHeight: 1.8,
            marginTop: i > 0 && !lines[i - 1]?.trim().startsWith('(') ? '2px' : '0',
          }}
        >
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '1.5px',
            backgroundColor: bulletColor ?? '#666',
            flexShrink: 0,
            marginTop: '0.55rem',
          }} />
          <span>{parseMarkupTags(content)}</span>
        </div>
      )
    }
  })

  return <div>{items}</div>
}

export default function IdentitySanitySection({ sanityConditions, panicInfo }: IdentitySanitySectionProps) {
  if (!panicInfo && sanityConditions.length === 0) {
    return null
  }

  const increaseConditions = sanityConditions.filter(c => c.condition_type === 'increase')
  const decreaseConditions = sanityConditions.filter(c => c.condition_type === 'decrease')

  const panicImageUrl =
    panicInfo?.name === '사랑과 증오' ? BRAIN_LOVE_HATE_URL : BRAIN_URL

  return (
    <div className="card p-6">
      {/* Section heading */}
      <h2
        className="font-serif font-light mb-5"
        style={{ color: 'var(--gold)', fontSize: '1rem', letterSpacing: '0.08em' }}
      >
        패닉
      </h2>

      <div className="space-y-4">
        {/* ── 패닉 타입 ─────────────────────────────────── */}
        {panicInfo && (
          <div>
            <div className="mb-3">
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: '#80c9ff',
                  border: '1px solid rgba(128,201,255,0.5)',
                  padding: '2px 8px',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                패닉 타입
              </span>
            </div>

            <div className="flex items-start gap-4 mb-3">
              <div className="flex-shrink-0">
                <Image
                  src={panicImageUrl}
                  alt="패닉"
                  width={88}
                  height={88}
                  style={{
                    width: 'auto',
                    height: 'auto',
                    filter: 'drop-shadow(0 0 8px rgba(200,60,60,0.5))',
                  }}
                />
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: '#d4a050',
                    marginBottom: '4px',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  · 패닉 효과
                </div>
                {panicInfo.description && (
                  <p
                    style={{
                      color: '#cccccc',
                      fontSize: '0.8125rem',
                      lineHeight: 1.75,
                    }}
                  >
                    {panicInfo.description}
                  </p>
                )}
              </div>
            </div>

            <div
              className="font-serif font-bold"
              style={{
                color: '#e04040',
                fontSize: '1.5rem',
                lineHeight: 1.2,
                textShadow: '0 0 16px rgba(220,60,60,0.35)',
              }}
            >
              {panicInfo.name}
            </div>
          </div>
        )}

        {/* ── 기본 정신력 증가 조건 ─────────────────────── */}
        {increaseConditions.length > 0 && (
          <div className="relative overflow-hidden">
            <div
              style={{
                position: 'absolute',
                right: '-4px',
                bottom: '-4px',
                opacity: 0.07,
                pointerEvents: 'none',
              }}
            >
              <Image
                src={SANITY_INCREASE_BG}
                alt=""
                width={100}
                height={100}
                style={{ height: '6.25rem', width: 'auto' }}
              />
            </div>

            <div className="mb-2">
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#80c9ff',
                  border: '1px solid rgba(128,201,255,0.5)',
                  padding: '2px 8px',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                기본 정신력 증가 조건
              </span>
            </div>

            <div
              className="relative"
              style={{
                color: '#cccccc',
                fontSize: '0.8125rem',
                lineHeight: 1.85,
                whiteSpace: 'pre-line',
              }}
            >
              {increaseConditions.map((c, i) => (
                <div key={`inc-${i}`}>
                  {renderSanityText(c.text, '#80c9ff')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 기본 정신력 감소 조건 ─────────────────────── */}
        {decreaseConditions.length > 0 && (
          <div className="relative overflow-hidden">
            <div
              style={{
                position: 'absolute',
                right: '-4px',
                bottom: '-4px',
                opacity: 0.07,
                pointerEvents: 'none',
              }}
            >
              <Image
                src={SANITY_DECREASE_BG}
                alt=""
                width={100}
                height={100}
                style={{ height: '6.25rem', width: 'auto' }}
              />
            </div>

            <div className="mb-2">
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#fe4b48',
                  border: '1px solid rgba(254,75,72,0.5)',
                  padding: '2px 8px',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                기본 정신력 감소 조건
              </span>
            </div>

            <div
              className="relative"
              style={{
                color: '#cccccc',
                fontSize: '0.8125rem',
                lineHeight: 1.85,
                whiteSpace: 'pre-line',
              }}
            >
              {decreaseConditions.map((c, i) => (
                <div key={`dec-${i}`}>
                  {renderSanityText(c.text, '#fe4b48')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
