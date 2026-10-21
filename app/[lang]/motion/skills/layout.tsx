import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import WithSectionMessages from '@/components/providers/WithSectionMessages'
import BackLink from '@/components/navigation/BackLink'
import MotionScreenFlag from '@/components/motion/MotionScreenFlag'

/**
 * The motion page and its loading screen share this frame: no navigation or footer, a way back beside the title, and on
 * desktop the viewport's height, which the page's columns fill and scroll on their own.
 */
export default async function MotionLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'motionPage' })
  return (
    <WithSectionMessages section="motion" lang={lang}>
      <MotionScreenFlag />
      <div className="mx-auto max-w-[90rem] px-4 pb-24 pt-3 md:pb-10 lg:flex lg:h-[100dvh] lg:flex-col lg:pb-4">
        <header className="mb-3 flex shrink-0 items-center gap-1">
          <BackLink href="/" aria-label={t('back')} title={t('back')}
            className="-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
            <ArrowLeft size={20} aria-hidden="true" />
          </BackLink>
          <h1 className="truncate font-[family-name:var(--font-heading)] text-[1.375rem] leading-tight text-[var(--gold)] md:text-[1.75rem]">{t('title')}</h1>
        </header>
        {children}
      </div>
    </WithSectionMessages>
  )
}
