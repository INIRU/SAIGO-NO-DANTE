import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLegalDoc } from '@/lib/data/legal'

export default async function AdminLegalPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) redirect('/')

  const [privacy, terms] = await Promise.all([
    getLegalDoc('privacy'),
    getLegalDoc('terms'),
  ])

  const docs = [
    { type: 'privacy', label: '개인정보 처리방침', doc: privacy },
    { type: 'terms',   label: '이용약관',          doc: terms   },
  ]

  return (
    <div>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>
            약관 관리
          </h1>
          <p style={{ color: '#555566', fontSize: '13px' }}>
            이용약관과 개인정보 처리방침을 수정합니다.
          </p>
        </div>

        <div className="space-y-4">
          {docs.map(({ type, label, doc }) => (
            <div key={type} className="card p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-serif font-bold" style={{ color: '#c8a450' }}>{label}</p>
                {doc ? (
                  <p style={{ color: '#555566', fontSize: '12px', marginTop: '2px' }}>
                    최종 수정: {doc.last_updated} · {doc.sections.length}개 섹션
                  </p>
                ) : (
                  <p style={{ color: '#443333', fontSize: '12px', marginTop: '2px' }}>
                    데이터 없음 — 시드 스크립트를 실행하거나 직접 작성하세요.
                  </p>
                )}
              </div>
              <Link
                href={`/admin/legal/${type}`}
                style={{
                  padding: '7px 18px', borderRadius: '4px', fontSize: '13px',
                  background: 'rgba(200,144,10,0.1)', border: '1px solid var(--border)',
                  color: 'var(--gold)', whiteSpace: 'nowrap',
                }}
                className="hover:bg-yellow-400/10 transition-colors"
              >
                편집
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 card p-4" style={{ borderColor: '#2a2020' }}>
          <p style={{ color: '#555566', fontSize: '12px', lineHeight: 1.7 }}>
            <span style={{ color: '#c8a450' }}>초기 데이터가 없다면</span> 터미널에서 다음 명령을 실행하세요:
          </p>
          <code style={{
            display: 'block', marginTop: '8px', padding: '8px 12px',
            background: '#0d0b08', borderRadius: '4px',
            color: '#88cc88', fontSize: '12px', fontFamily: 'monospace',
          }}>
            node --env-file=.env.local scripts/seed-legal-docs.mjs
          </code>
        </div>
      </div>
    </div>
  )
}
