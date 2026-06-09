import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import CalendarClient from './CalendarClient'

function normalizeLang(lang: string): 'ko' | 'en' | 'ja' {
  return lang === 'en' || lang === 'ja' ? lang : 'ko'
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params
  const lang = normalizeLang(rawLang)
  const t = await getTranslations({ locale: lang, namespace: 'calendar.meta' })

  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `https://saigo-no-dante.com/${lang}/calendar` },
    openGraph: {
      title: t('title'),
      description: t('description'),
    },
    twitter: {
      title: t('title'),
      description: t('description'),
    },
  }
}

export default async function CalendarPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params
  const lang = normalizeLang(rawLang)
  const t = await getTranslations({ locale: lang, namespace: 'calendar' })

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#0d0b08] pt-24 pb-16 text-[#d8c7a0]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-[rgba(200,144,10,0.18)] pb-5">
          <p className="font-mono text-[0.875rem] leading-none text-[#8a6010]">
            {t('eyebrow')}
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[42rem]">
              <h1 className="font-serif text-[2.125rem] leading-tight text-[#e8b030] sm:text-[2.5rem] lg:text-[3rem]">
                {t('title')}
              </h1>
              <p className="mt-2 text-[1rem] leading-7 text-[#a89468]">
                {t('description')}
              </p>
            </div>
            <p className="max-w-[24rem] text-[0.875rem] leading-6 text-[#7d6b49]">
              {t('currentMonthOnly')}
            </p>
          </div>
        </header>

        <CalendarClient />
      </div>
    </div>
  )
}
