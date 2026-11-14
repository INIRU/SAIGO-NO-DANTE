'use client'

import { Link } from '@/lib/i18n/navigation'
import { ArrowRight } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import PageHeader from '@/components/ui/PageHeader'

export default function SinnersInteractive({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const lang = useLocale()
  useRoutePrefetch([`/${lang}/sinners/identities`, `/${lang}/sinners/ego`])
  return (
    <div className="min-h-screen pt-[5.5rem] pb-16 px-6 max-w-7xl mx-auto relative">

      <div className="relative" style={{ zIndex: 1 }}>
        <PageHeader title={t('sinners.title' as any)} description={t('sinners.subtitle' as any)} actions={
          // The home hero's framed buttons: one gold line on the octagon frame, the game's yellow glow on hover and focus.
          <nav className="flex flex-wrap gap-3">
            {[
              { href: '/sinners/identities', label: t('sinners.viewAllIdentities' as any) },
              { href: '/sinners/ego', label: t('sinners.viewAllEgo' as any) },
            ].map(link => (
              <Link key={link.href} href={link.href} className="group frame frame-strong frame-glow press flex min-h-[3.25rem] items-center gap-2 px-3 font-[family-name:var(--font-heading)] text-[0.9375rem] text-[var(--gold-light)] [--frame-w:0.875rem]">
                {link.label}
                <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            ))}
          </nav>
        } />
      </div>

      {children}
    </div>
  )
}
