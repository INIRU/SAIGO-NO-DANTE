import Image from 'next/image'
import type { SanityCondition, PanicType } from '@/lib/types'
import { STORAGE_BASE } from '@/lib/constants/game'

interface IdentitySanitySectionProps {
  sanityConditions: SanityCondition[]
  panicInfo?: PanicType | null
}

export default function IdentitySanitySection({ sanityConditions, panicInfo }: IdentitySanitySectionProps) {
  if (!panicInfo && sanityConditions.length === 0) {
    return null
  }

  const increaseConditions = sanityConditions.filter(c => c.condition_type === 'increase')
  const decreaseConditions = sanityConditions.filter(c => c.condition_type === 'decrease')

  return (
    <div className="card p-6">
      {panicInfo && (
        <div className="mb-5">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded mb-3"
            style={{
              background: 'rgba(180,50,50,0.12)',
              border: '1px solid rgba(180,50,50,0.35)',
            }}
          >
            <span className="text-xs font-bold" style={{ color: '#e05555' }}>패닉 타입</span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <Image
              src={`${STORAGE_BASE}/icons/stats/panic.webp`}
              alt=""
              width={40}
              height={40}
              style={{ width: '2.5rem', height: '2.5rem', filter: 'drop-shadow(0 0 4px rgba(180,50,50,0.5))' }}
            />
            <div>
              <p className="text-xs" style={{ color: '#999' }}>패닉 효과</p>
              <p className="text-sm font-medium" style={{ color: '#ddd' }}>{panicInfo.description}</p>
            </div>
          </div>
        </div>
      )}

      <h2
        className="font-serif font-light mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        패닉
      </h2>

      {increaseConditions.length > 0 && (
        <div className="mb-4">
          <div
            className="inline-flex items-center px-3 py-1 rounded mb-3"
            style={{
              background: 'rgba(200,170,60,0.12)',
              border: '1px solid rgba(200,170,60,0.4)',
            }}
          >
            <span className="text-xs font-bold" style={{ color: '#c8aa3c' }}>
              기본 정신력 증가 조건
            </span>
          </div>
          <div className="space-y-2 pl-1">
            {increaseConditions.map((c, i) => (
              <div key={`inc-${i}`} className="text-sm leading-relaxed" style={{ color: '#ccc' }}>
                <ConditionText text={c.text} />
              </div>
            ))}
          </div>
        </div>
      )}

      {decreaseConditions.length > 0 && (
        <div>
          <div
            className="inline-flex items-center px-3 py-1 rounded mb-3"
            style={{
              background: 'rgba(180,50,50,0.12)',
              border: '1px solid rgba(180,50,50,0.35)',
            }}
          >
            <span className="text-xs font-bold" style={{ color: '#e05555' }}>
              기본 정신력 감소 조건
            </span>
          </div>
          <div className="space-y-2 pl-1">
            {decreaseConditions.map((c, i) => (
              <div key={`dec-${i}`} className="text-sm leading-relaxed" style={{ color: '#ccc' }}>
                <ConditionText text={c.text} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConditionText({ text }: { text: string }) {
  const cleaned = text
    .replace(/<size=\d+%>/g, '')
    .replace(/<\/size>/g, '')

  const parts: (string | React.ReactElement)[] = []
  let remaining = cleaned
  let key = 0

  const colorRegex = /<color=([^>]+)>([\s\S]*?)<\/color>/
  let match = colorRegex.exec(remaining)
  while (match) {
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index))
    }
    parts.push(
      <span key={key++} style={{ color: match[1] }}>{match[2]}</span>
    )
    remaining = remaining.slice(match.index + match[0].length)
    match = colorRegex.exec(remaining)
  }
  if (remaining) parts.push(remaining)

  const result: (string | React.ReactElement)[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      const lines = part.split('\n')
      lines.forEach((line, i) => {
        if (i > 0) result.push(<br key={`br-${key++}`} />)
        result.push(line)
      })
    } else {
      result.push(part)
    }
  }

  return <>{'\u00B7'}{result}</>
}
