import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import PageHeader from '@/components/ui/PageHeader'
import { LICENSES } from '@/lib/licenses'
import { pageMetadata } from '@/lib/seo/metadata'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'licensesPage' })
  return pageMetadata({ lang, path: '/licenses', title: t('title'), description: t('description') })
}

export default async function LicensesPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('page-1h')

  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'licensesPage' })
  const license = (value: string) => (value === 'freeFont' ? t('freeFont') : value)
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[42rem] px-4 pb-24 pt-[5.5rem] md:px-6">
      <PageHeader title={t('title')} />
      {LICENSES.map(({ group, items }) => (
        <section key={group} aria-labelledby={`licenses-${group}`} className="border-t border-[#241c14] py-8 first-of-type:border-t-0">
          <h2 id={`licenses-${group}`} className="font-[family-name:var(--font-heading)] text-[1.125rem] font-bold text-[var(--gold)] md:text-[1.25rem]">
            {t(group)}
          </h2>
          <ul className="mt-3 divide-y divide-[#241c14]">
            {items.map(item => (
              <li key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-3">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] text-[var(--text-primary)]">{item.name}</p>
                  <p className="text-[0.8125rem] text-[var(--text-tertiary)]">© {item.holder}</p>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="hit-target text-right text-[0.8125rem] text-[var(--gold)] underline-offset-4 transition-colors duration-150 hover:text-[var(--gold-light)] hover:underline motion-reduce:transition-none">
                  {license(item.license)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
