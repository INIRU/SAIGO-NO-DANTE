import { JsonLdScript } from 'next-seo'
import { SITE_NAME, SITE_URL, localeUrl, metaText } from '@/lib/seo/metadata'

type JsonLdProps = {
  data: Record<string, unknown>
}

export default function JsonLd({ data }: JsonLdProps) {
  return <JsonLdScript data={data} scriptKey={String(data['@type'] ?? 'structured-data')} />
}

/**
 * The site name search engines show: one short name, with the other names as alternates (Google's site name guidance).
 * No SearchAction: site search has no URL form (the old /sinners?q= target ignored the query).
 */
export function websiteJsonLd(lang: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME.ko,
    alternateName: [SITE_NAME.en, new URL(SITE_URL).hostname],
    url: localeUrl(lang),
    description: metaText('home.meta.description', lang),
    inLanguage: lang,
  }
}

export function organizationJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SAIGO NO DANTE',
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512x512.webp`,
  }
}

export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function videoGameJsonLd(lang: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: 'Limbus Company',
    alternateName: '림버스 컴퍼니',
    description: '프로젝트 문이 개발한 턴제 RPG. 12명의 수감자와 함께 도시를 탐험하며 인격과 E.G.O를 수집한다.',
    genre: ['턴제 RPG', 'Turn-based RPG', '가챠', 'Gacha'],
    gamePlatform: ['Android', 'iOS', 'PC (Steam)'],
    applicationCategory: 'Game',
    operatingSystem: 'Android, iOS, Windows',
    publisher: {
      '@type': 'Organization',
      name: 'Project Moon',
      alternateName: '프로젝트 문',
      url: 'https://projectmoon.studio',
    },
    inLanguage: ['ko', 'en', 'ja', 'zh'],
    url: 'https://limbuscompany.com',
    subjectOf: {
      '@type': 'WebSite',
      name: '최애의 관리자 | SAIGO NO DANTE',
      url: localeUrl(lang),
      description: '림버스 컴퍼니 비공식 팬 정보 사이트',
    },
  }
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function itemListJsonLd(opts: {
  name: string
  description: string
  url: string
  items: { name: string; url: string; position: number }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map(item => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      url: item.url,
    })),
  }
}

export function gameCharacterJsonLd(opts: {
  name: string
  description: string
  image: string
  url: string
  siteUrl: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: opts.name,
    description: opts.description,
    image: opts.image,
    url: opts.url,
    isPartOf: {
      '@type': 'VideoGame',
      name: 'Limbus Company',
      alternateName: '림버스 컴퍼니',
      publisher: { '@type': 'Organization', name: 'Project Moon' },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': opts.url,
      isPartOf: { '@type': 'WebSite', url: opts.siteUrl },
    },
  }
}
