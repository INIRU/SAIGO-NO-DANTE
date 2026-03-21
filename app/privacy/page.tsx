import Link from 'next/link'
import { getLegalDoc, type LegalSection } from '@/lib/data/legal'

export const revalidate = 3600
export const metadata = { title: '개인정보 처리방침 | 최애의 관리자' }

function SectionBlock({ section }: { section: LegalSection }) {
  return (
    <section className="card p-6 space-y-3">
      <h2 className="font-serif font-light text-lg mb-3" style={{ color: '#c8a450' }}>
        {section.heading}
      </h2>
      {section.body && (
        <p style={{ color: '#9e9e9e' }}>{section.body}</p>
      )}
      {section.items && section.items.length > 0 && (
        <ul className="list-none space-y-2 pl-2">
          {section.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2" style={{ color: '#9e9e9e' }}>
              <span style={{
                color: section.itemAccent === 'red' ? '#cc4444' : 'var(--gold)',
                flexShrink: 0, marginTop: '2px',
              }}>◆</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function PrivacyPage() {
  const doc = await getLegalDoc('privacy')

  const title = doc?.title ?? '개인정보 처리방침'
  const lastUpdated = doc?.last_updated ?? '2025년 1월 1일'
  const sections: LegalSection[] = doc?.sections ?? []

  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2 text-sm" style={{ color: '#888888' }}>
            <Link href="/" className="hover:text-yellow-300 transition-colors">홈</Link>
            <span>›</span>
            <span style={{ color: 'var(--gold)' }}>{title}</span>
          </div>
          <p style={{ color: 'var(--gold-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>PRIVACY POLICY</p>
          <h1 className="font-serif text-3xl font-bold mb-2" style={{ color: 'var(--gold)' }}>
            {title}
          </h1>
          <div style={{ width: '6rem', height: '0.0625rem', background: 'linear-gradient(90deg, var(--gold), transparent)', marginTop: '0.75rem', marginBottom: '1.5rem' }} />
          <p style={{ color: '#888888', fontSize: '0.8125rem' }}>최종 수정일: {lastUpdated}</p>
        </div>

        <div className="space-y-8" style={{ fontSize: '0.875rem', lineHeight: '1.9' }}>
          {sections.length > 0
            ? sections.map((s, i) => <SectionBlock key={i} section={s} />)
            : <div className="card p-8 text-center" style={{ color: '#888888' }}>내용이 없습니다.</div>
          }
        </div>

        <div className="mt-10 text-center">
          <Link href="/terms" style={{ color: 'var(--gold-dim)', fontSize: '0.8125rem' }}
            className="hover:text-yellow-300 transition-colors underline underline-offset-2">
            이용약관 보기 →
          </Link>
        </div>
      </div>
    </div>
  )
}
