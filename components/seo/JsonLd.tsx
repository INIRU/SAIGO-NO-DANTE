type JsonLdProps = {
  data: Record<string, unknown>
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function websiteJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '최애의 관리자 | SAIGO NO DANTE',
    alternateName: 'SAIGO NO DANTE',
    url: siteUrl,
    description: 'Limbus Company 팬 아카이브 — 수감자 DB, 덱 빌더, 덱 공유',
    inLanguage: 'ko',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/sinners?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function organizationJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SAIGO NO DANTE',
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512x512.png`,
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
      publisher: { '@type': 'Organization', name: 'Project Moon' },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': opts.url,
      isPartOf: { '@type': 'WebSite', url: opts.siteUrl },
    },
  }
}
