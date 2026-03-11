import Link from 'next/link'
import { Anchor } from 'lucide-react'

export const metadata = { title: '점검 중 | SAIGO NO DANTE' }

const CHARON_LINES = [
  '카론, 기다리는 거 못해. 100초만 기다려 줄게.',
  '늦으면 메피랑 먼저 갈 거야.',
  '아야하는 승객들 있어. 울면 안 돼.',
  '승객들, 좌석에 앉아서 기다려. 카론이 째깍째깍 해줄게.',
  '알쏭달쏭해. 뭐가 나올지 모르겠어.',
  '카론, 빙글빙글.',
  '…멀미 봉투는 좌석 밑에 있어. 메피한테 토하지 마.',
  '그래서 카론이 안전벨트 잘 하라고 했잖아.',
]

function formatEndTime(iso: string) {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hour = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${month}월 ${day}일 ${hour}:${min}`
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; message?: string; reason?: string; ends_at?: string }>
}) {
  const { from, message, reason, ends_at } = await searchParams

  const randomLine = CHARON_LINES[Math.floor(Math.random() * CHARON_LINES.length)]

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0d0b08', position: 'relative', overflow: 'hidden' }}
    >
      {/* Atmospheric background glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '40rem',
        height: '40rem',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 40%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className="text-center max-w-lg" style={{ position: 'relative', zIndex: 1 }}>
        {/* 카론 아이콘 */}
        <div
          className="mx-auto mb-6 flex items-center justify-center"
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'rgba(200,144,10,0.08)',
            border: '2px solid rgba(200,144,10,0.2)',
            boxShadow: '0 0 40px rgba(200,144,10,0.1)',
          }}
        >
          <Anchor size={38} style={{ color: '#c8900a' }} />
        </div>

        {/* 메인 안내 */}
        <h1
          className="font-serif text-2xl font-bold mb-2"
          style={{ color: '#c8900a' }}
        >
          점검 중
        </h1>

        <p
          className="mb-6"
          style={{ color: '#7a6845', fontSize: '0.8125rem' }}
        >
          MAINTENANCE IN PROGRESS
        </p>

        {/* Decorative line */}
        <div style={{ width: '6rem', height: '0.0625rem', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', margin: '0 auto 1.5rem' }} />

        {/* 카론 대사 박스 */}
        <div
          className="mx-auto mb-6 px-6 py-4 rounded-lg"
          style={{
            background: 'rgba(200,144,10,0.06)',
            border: '1px solid rgba(200,144,10,0.15)',
            maxWidth: 420,
          }}
        >
          <p
            style={{
              color: '#e8b030',
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: 6,
              letterSpacing: '0.05em',
            }}
          >
            — 카론
          </p>
          <p
            style={{
              color: '#a89070',
              fontSize: '0.9375rem',
              lineHeight: 1.7,
              fontStyle: 'italic',
            }}
          >
            &ldquo;{randomLine}&rdquo;
          </p>
        </div>

        {/* 커스텀 점검 메시지 */}
        {message && (
          <p
            className="mb-3"
            style={{ color: '#a89070', fontSize: '0.875rem', lineHeight: 1.6 }}
          >
            {message}
          </p>
        )}

        {/* 점검 정보 */}
        <div className="mb-6 space-y-1.5">
          {reason && (
            <p style={{ color: '#7a6845', fontSize: '0.8125rem' }}>
              <span style={{ color: '#555566' }}>사유: </span>{reason}
            </p>
          )}
          <p style={{ color: '#7a6845', fontSize: '0.8125rem' }}>
            <span style={{ color: '#555566' }}>예상 종료: </span>
            {ends_at ? formatEndTime(ends_at) : '미정'}
          </p>
          {from && (
            <p style={{ color: '#3a3530', fontSize: '0.75rem' }}>
              <code style={{ color: '#555566' }}>{from}</code>
            </p>
          )}
        </div>

        <Link
          href="/"
          className="inline-block px-5 py-2 rounded transition-colors hover:bg-[rgba(200,144,10,0.25)]"
          style={{
            background: 'rgba(200,144,10,0.12)',
            color: '#c8900a',
            border: '1px solid rgba(200,144,10,0.25)',
            fontSize: '0.8125rem',
          }}
        >
          카론이 데려다줄게. 돌아가자.
        </Link>
      </div>
    </div>
  )
}
