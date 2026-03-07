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

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; message?: string }>
}) {
  const { from, message } = await searchParams

  // 랜덤 대사 (빌드 시 결정)
  const randomLine = CHARON_LINES[Math.floor(Math.random() * CHARON_LINES.length)]

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0d0b08' }}
    >
      <div className="text-center max-w-lg">
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
            className="mb-4"
            style={{ color: '#a89070', fontSize: '0.875rem', lineHeight: 1.6 }}
          >
            {message}
          </p>
        )}

        {from && (
          <p className="mb-6" style={{ color: '#3a3530', fontSize: '0.75rem' }}>
            <code style={{ color: '#555566' }}>{from}</code>
          </p>
        )}

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
