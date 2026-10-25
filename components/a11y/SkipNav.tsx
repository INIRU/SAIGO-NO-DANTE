import { getTranslations } from 'next-intl/server'

export default async function SkipNav({ lang }: { lang: string }) {
  const t = await getTranslations({ locale: lang, namespace: 'common' })
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-[var(--gold)] focus:px-4 focus:py-2 focus:text-black focus:font-bold focus:outline-none"
    >
      {t('skipToContent')}
    </a>
  )
}
