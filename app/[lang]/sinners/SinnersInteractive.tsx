'use client'

import { Link } from '@/lib/i18n/navigation'
import { Users, Sparkles } from 'lucide-react'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { fadeIn } from '@/lib/animations'
import { useTranslations, useLocale } from 'next-intl'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'
import PageHeader from '@/components/ui/PageHeader'

export default function SinnersInteractive({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const lang = useLocale()
  useRoutePrefetch([`/${lang}/sinners/identities`, `/${lang}/sinners/ego`])
  return (
    <div className="min-h-screen pt-[5.5rem] pb-16 px-6 max-w-7xl mx-auto relative">

      {/* 배경 대기감 */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '50rem',
          height: '50rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, transparent 60%)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '20%',
          width: '30rem',
          height: '30rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.02) 0%, transparent 60%)',
        }} />
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
        <PageHeader title={t('sinners.title' as any)} description={t('sinners.subtitle' as any)} actions={
          <nav className="flex flex-wrap gap-2">
            <Link href="/sinners/identities" className="flex min-h-10 items-center gap-2 rounded px-3 text-sm text-[var(--gold-light)] transition-colors hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]" style={{ border: '1px solid #2e2417' }}>
              <Users size={15} aria-hidden />
              {t('sinners.viewAllIdentities' as any)}
            </Link>
            <Link href="/sinners/ego" className="flex min-h-10 items-center gap-2 rounded px-3 text-sm text-[var(--gold-light)] transition-colors hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]" style={{ border: '1px solid #2e2417' }}>
              <Sparkles size={15} aria-hidden />
              {t('sinners.viewAllEgo' as any)}
            </Link>
          </nav>
        } />
      </div>

      {/* 서버 렌더링된 카드 그리드 — children으로 주입 */}
      <ScrollReveal variant={fadeIn} as="div">
        {children}
      </ScrollReveal>

      {/* 하단 장식 */}
      <div className="mt-16 flex items-center justify-center gap-4">
        <div style={{
          width: '4rem',
          height: '0.0625rem',
          background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.2))',
        }} />
        <span className="font-mono" style={{ color: '#2a2015', fontSize: '0.5625rem', letterSpacing: '0.3em' }}>
          XII
        </span>
        <div style={{
          width: '4rem',
          height: '0.0625rem',
          background: 'linear-gradient(90deg, rgba(200,144,10,0.2), transparent)',
        }} />
      </div>
    </div>
  )
}
