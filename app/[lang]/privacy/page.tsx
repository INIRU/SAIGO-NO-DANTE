import Link from 'next/link'
import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { getLegalDoc, type LegalSection } from '@/lib/data/legal'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang as SupportedLang] ?? entry['ko'] ?? key
  }
  return { title: `${t('legal.privacy.title')} | SAIGO NO DANTE` }
}

function SectionBlock({ section, index }: { section: LegalSection; index: number }) {
  return (
    <section style={{
      background: 'rgba(255,255,255,0.02)',
      borderLeft: '0.1875rem solid rgba(200,144,10,0.25)',
      borderRadius: '0.25rem',
      padding: '1.5rem 1.75rem',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{
          color: 'rgba(200,144,10,0.35)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          fontWeight: 600,
          minWidth: '1.5rem',
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 style={{
          color: '#c8a450',
          fontSize: '1.0625rem',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}>
          {section.heading}
        </h2>
      </div>

      {section.body && (
        <p style={{
          color: '#9e9eaa',
          fontSize: '0.8125rem',
          lineHeight: 1.9,
          paddingLeft: '2.25rem',
        }}>
          {section.body}
        </p>
      )}

      {section.items && section.items.length > 0 && (
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          paddingLeft: '2.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: section.body ? '0.75rem' : 0,
        }}>
          {section.items.map((item, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
              color: '#9e9eaa',
              fontSize: '0.8125rem',
              lineHeight: 1.8,
            }}>
              <span style={{
                color: section.itemAccent === 'red' ? '#cc4444' : 'rgba(200,144,10,0.6)',
                flexShrink: 0,
                marginTop: '0.125rem',
                fontSize: '0.5rem',
              }}>●</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('page-1h')

  const { lang } = await params
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang as SupportedLang] ?? entry['ko'] ?? key
  }

  const doc = await getLegalDoc('privacy', lang)
  const title = doc?.title ?? t('legal.privacy.title')
  const lastUpdated = doc?.last_updated ?? '2025-01-01'
  const sections: LegalSection[] = doc?.sections ?? []

  return (
    <div style={{ minHeight: '100vh', paddingTop: '7rem', paddingBottom: '5rem' }}>
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* Breadcrumb */}
        <nav style={{ marginBottom: '2.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8125rem',
            color: '#666677',
          }}>
            <Link href={`/${lang}`} style={{ color: '#888899', transition: 'color 0.2s' }}
              className="hover:text-yellow-300">
              {t('legal.breadcrumb.home')}
            </Link>
            <span style={{ color: '#444455' }}>/</span>
            <span style={{ color: 'var(--gold-dim)' }}>{t('legal.privacy.title')}</span>
          </div>
        </nav>

        {/* Hero header */}
        <header style={{ marginBottom: '3rem' }}>
          <p style={{
            color: 'rgba(200,144,10,0.45)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.625rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '0.625rem',
          }}>
            PRIVACY POLICY
          </p>
          <h1 style={{
            color: '#e8e8f0',
            fontSize: '1.75rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            marginBottom: '0.75rem',
          }}>
            {title}
          </h1>
          <div style={{
            width: '4rem',
            height: '0.125rem',
            background: 'linear-gradient(90deg, #c8900a, transparent)',
            marginBottom: '1rem',
          }} />
          <p style={{
            color: '#666677',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
          }}>
            {t('legal.lastUpdated')}: {lastUpdated}
          </p>
        </header>

        {/* Table of contents */}
        {sections.length > 0 && (
          <nav style={{
            background: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(200,144,10,0.08)',
            borderRadius: '0.375rem',
            padding: '1.25rem 1.5rem',
            marginBottom: '2.5rem',
          }}>
            <p style={{
              color: 'rgba(200,144,10,0.5)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}>
              {t('legal.tableOfContents')}
            </p>
            <ol style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
            }}>
              {sections.map((s, i) => (
                <li key={i}>
                  <a href={`#section-${i}`} style={{
                    color: '#888899',
                    fontSize: '0.8125rem',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.625rem',
                    transition: 'color 0.2s',
                  }} className="hover:text-yellow-300">
                    <span style={{
                      color: 'rgba(200,144,10,0.3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      minWidth: '1.25rem',
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {sections.length > 0
            ? sections.map((s, i) => (
                <div key={i} id={`section-${i}`}>
                  <SectionBlock section={s} index={i} />
                </div>
              ))
            : (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '0.375rem',
                padding: '3rem',
                textAlign: 'center',
                color: '#666677',
                fontSize: '0.875rem',
              }}>
                {t('legal.empty')}
              </div>
            )
          }
        </div>

        {/* Footer links */}
        <footer style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid rgba(200,144,10,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Link href={`/${lang}/terms`} style={{
            color: 'var(--gold-dim)',
            fontSize: '0.8125rem',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            transition: 'color 0.2s',
          }} className="hover:text-yellow-300">
            {t('legal.privacy.linkToTerms')} →
          </Link>
          <a href="#" style={{
            color: '#666677',
            fontSize: '0.75rem',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }} className="hover:text-yellow-300">
            ↑ {t('legal.backToTop')}
          </a>
        </footer>

      </div>
    </div>
  )
}
