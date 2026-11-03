import { useMemo, type ComponentProps } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import type { TranslationKey } from '@/lib/i18n/translations'

export const NAV_GROUPS: { labelKey: string; items: { href: string; labelKey: string }[] }[] = [
  {
    labelKey: 'nav.db.title',
    items: [
      { href: '/sinners',        labelKey: 'nav.sinners' },
      { href: '/mirror-dungeon', labelKey: 'nav.db.mirrorDungeon' },
      { href: '/keywords',       labelKey: 'nav.db.keywords' },
    ],
  },
  {
    labelKey: 'nav.community.title',
    items: [
      { href: '/decks',               labelKey: 'nav.decks' },
      { href: '/planner/community',   labelKey: 'nav.community.planner' },
      { href: '/friends',             labelKey: 'nav.community.friends' },
      { href: '/collection',          labelKey: 'nav.community.collection' },
    ],
  },
  {
    labelKey: 'nav.tools.title',
    items: [
      { href: '/meta',             labelKey: 'nav.tools.meta' },
      { href: '/tools/experience', labelKey: 'nav.tools.experience' },
      { href: '/tools/lunacy',     labelKey: 'nav.tools.lunacy' },
      { href: '/tools/damage',     labelKey: 'nav.tools.damage' },
      { href: '/tools/clash',      labelKey: 'nav.tools.clash' },
      { href: '/developers',       labelKey: 'nav.tools.developers' },
    ],
  },
  {
    labelKey: 'nav.motion.title',
    items: [
      { href: '/motion/skills', labelKey: 'nav.motion.skills' },
    ],
  },
  {
    labelKey: 'nav.fun.title',
    items: [
      { href: '/random', labelKey: 'nav.fun.random' },
      { href: '/prescript', labelKey: 'nav.fun.prescript' },
    ],
  },
]

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)]'
// 데스크탑 상단 항목 공통: 같은 높이(h-9), hover는 사이트 금색
export const navBase = `flex h-9 items-center gap-1.5 rounded-md px-3 whitespace-nowrap transition-colors duration-150 hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--gold-light)] ${focusRing}`
// 메뉴 그룹: 제목 서체(Kotra), 오른쪽 도구(문의·언어·로그인): 본문 서체
export const groupItem = `${navBase} [font-family:var(--font-heading)] text-[0.9375rem] tracking-[0.01em]`
export const navItem = `${navBase} text-[0.875rem] font-medium`
export const menuRow = `block rounded-[0.3125rem] px-3 py-2 text-[0.875rem] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--gold-light)] ${focusRing}`
// 메뉴는 트리거 바로 아래에 붙고 제자리에서 살짝 내려오기만 한다 (가로 이동 없음)
export const panel = 'nav-pop rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[var(--shadow-lg)]'

export function localeHref(locale: string, href: string) {
  return href === '/' ? `/${locale}` : `/${locale}${href}`
}

/**
 * Locale-prefixed link that does not read the pathname. next-intl's Link calls usePathname(), which is request data on
 * routes with unknown params (/decks/[id]) and would push the whole navbar out of the static shell.
 */
export function NavLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  return <Link {...rest} href={localeHref(useLocale(), href)} />
}

export function useNavGroups() {
  const t = useTranslations()
  return useMemo(() => NAV_GROUPS.map(g => ({
    label: t(g.labelKey as TranslationKey),
    items: g.items.map(item => ({ href: item.href, label: t(item.labelKey as TranslationKey) })),
  })), [t])
}

/** `pathname` is null while it is still unknown (static shell on routes with unknown params): nothing is current yet. */
export function isActiveHref(pathname: string | null, href: string) {
  if (pathname === null) return false
  const stripped = pathname.replace(/^\/(ko|en|ja)(?=\/|$)/, '') || '/'
  return stripped === href || stripped.startsWith(href + '/')
}

// Until the profile answers, the circle stays empty rather than showing the default picture and swapping it.
export function NavAvatar({ url, size }: { url: string | null; size: string }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full border border-[var(--gold-dim)] bg-[var(--bg-card)]" style={{ width: size, height: size }}>
      {url && <Image src={url} alt="" fill sizes="32px" style={{ objectFit: 'cover' }} />}
    </span>
  )
}
