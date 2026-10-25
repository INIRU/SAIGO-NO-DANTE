import Link from 'next/link'
import type { LegalDoc } from '@/lib/data/legal'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import PageHeader, { PageHeaderSkeleton } from '@/components/ui/PageHeader'
import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import LegalToc from './LegalToc'

type LegalType = LegalDoc['type']

// Shared by the page and its skeleton so both keep the same grid.
const PAGE = 'mx-auto min-h-[100dvh] max-w-[42rem] px-4 pb-24 pt-[5.5rem] md:px-6 lg:grid lg:max-w-[62rem] lg:grid-cols-[13rem_minmax(0,42rem)] lg:content-start lg:justify-center lg:gap-x-16 print:block print:max-w-none print:p-0'
const HEAD = 'lg:col-start-2'
const NAV = 'sticky-under-nav z-30 -mx-4 border-b border-[#2e2417] bg-[var(--bg-deep)] px-4 py-2 md:-mx-6 md:px-6 lg:col-start-1 lg:row-start-2 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-8 print:hidden'
const ARTICLE = 'min-w-0 pt-8 lg:col-start-2 lg:row-start-2 print:pt-4'
const SECTION = 'border-t border-[#241c14] py-8 first:border-t-0 first:pt-0 print:break-inside-avoid print:border-[#ccc]'

const OTHER = { terms: 'privacy', privacy: 'terms' } as const
const OTHER_LINK = { terms: 'legal.terms.linkToPrivacy', privacy: 'legal.privacy.linkToTerms' } as const

export default function LegalDocument({ type, lang, doc }: { type: LegalType; lang: string; doc: LegalDoc | null }) {
  const t = (key: keyof typeof translations) => translations[key][lang as SupportedLang] ?? translations[key].ko
  const sections = doc?.sections ?? []
  const lastUpdated = doc?.last_updated
  // resolveVersion falls back to the date, so only show a version that says something new.
  const version = doc?.version && doc.version !== lastUpdated ? doc.version : null
  const otherHref = `/${lang}/${OTHER[type]}`
  const otherLabel = t(OTHER_LINK[type])

  return (
    <div className={PAGE}>
      <PageHeader
        className={`${HEAD} !mb-0 print:[&_h1]:text-black`}
        title={doc?.title ?? t(`legal.${type}.title`)}
        description={(lastUpdated || version) && <span className="flex flex-wrap gap-x-4 print:text-[#444]">
          {lastUpdated && <span>{t('legal.lastUpdated')} {lastUpdated}</span>}
          {version && <span>{t('legal.version')} {version}</span>}
        </span>}
      />

      {sections.length > 0 && (
        <nav aria-label={t('legal.tableOfContents')} className={NAV}>
          <LegalToc headings={sections.map(s => s.heading)} label={t('legal.tableOfContents')} otherHref={otherHref} otherLabel={otherLabel} />
        </nav>
      )}

      <article className={`${ARTICLE} text-base leading-[1.85] text-[var(--text-primary)] [overflow-wrap:anywhere] print:text-black ${lang === 'ko' ? 'break-keep' : ''}`}>
        {sections.length > 0 ? sections.map((section, i) => (
          <section key={i} id={`section-${i}`} aria-labelledby={`section-${i}-heading`} className={`${SECTION} scroll-mt-[calc(var(--nav-offset)+5rem)] lg:scroll-mt-[calc(var(--nav-offset)+2rem)]`}>
            <h2 id={`section-${i}-heading`} tabIndex={-1} className="font-[family-name:var(--font-heading)] text-[1.125rem] font-bold leading-snug text-[var(--gold)] md:text-[1.25rem] print:text-black">
              {section.heading}
            </h2>
            {section.body && <p className="mt-3">{section.body}</p>}
            {section.items && section.items.length > 0 && (
              <ul className={`${section.body ? 'mt-4' : 'mt-3'} space-y-2`}>
                {section.items.map((item, j) => (
                  <li key={j} className={`relative pl-5 before:absolute before:left-[0.1rem] before:top-[0.72em] before:size-[0.4375rem] before:rotate-45 ${section.itemAccent === 'red' ? 'before:bg-[#9b2c23]' : 'before:bg-[var(--gold)]'} print:before:bg-black`}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )) : (
          <p className="py-16 text-center text-[0.9375rem] text-[var(--text-secondary)]">{t('legal.empty')}</p>
        )}

        <footer className="mt-4 border-t border-[#2e2417] pt-6 print:hidden">
          <Link href={otherHref} className="text-[0.9375rem] text-[var(--gold)] underline-offset-4 transition-colors duration-150 hover:text-[var(--gold-light)] hover:underline motion-reduce:transition-none">
            {otherLabel}
          </Link>
        </footer>
      </article>
    </div>
  )
}

/** Mirrors LegalDocument: header, mobile jump bar or desktop rail, sections. */
export function LegalDocumentSkeleton() {
  return (
    <SkeletonPage className={PAGE}>
      <PageHeaderSkeleton titleWidth="9rem" description className={`${HEAD} !mb-0`} />
      <div className={NAV}>
        <Skeleton line className="h-11 w-full lg:hidden" />
        <div className="hidden space-y-[1.125rem] border-l border-[#2e2417] py-1.5 pl-4 lg:block">
          {['7rem', '8.5rem', '6.5rem', '8rem', '9rem', '10rem', '6rem'].map((w, i) => <SkeletonLine key={i} w={w} h="0.875rem" />)}
        </div>
      </div>
      <div className={ARTICLE}>
        {[3, 2, 4, 2].map((lines, i) => (
          <div key={i} className={SECTION}>
            <div className="flex h-[1.4rem] items-center md:h-[1.5625rem]"><SkeletonLine w="9rem" h="1.125rem" /></div>
            <div className="mt-3 space-y-[0.85rem]">
              {Array.from({ length: lines }, (_, j) => <SkeletonLine key={j} w={j === lines - 1 ? '60%' : '100%'} h="1rem" />)}
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  )
}
