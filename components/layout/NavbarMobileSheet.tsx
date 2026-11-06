'use client'

import type { CSSProperties } from 'react'
import styles from './NavbarMobileSheet.module.css'

import { MessageCircle } from 'lucide-react'
import { CalendarIcon } from '@/components/brand/icons'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/lib/i18n/navigation'
import type { TranslationKey } from '@/lib/i18n/translations'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { NavAvatar, NavLink, focusRing, isActiveHref, useNavGroups } from './nav-shared'

interface Props {
  mainNavLabel: string
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated'
  avatarUrl: string | null
  isSignedIn: boolean
  isAdmin: boolean
  onClose: () => void
}

/** The opened mobile menu. It only exists after a tap, so reading the pathname here never touches the static shell. */
export default function NavbarMobileSheet({ mainNavLabel, sessionStatus, avatarUrl, isSignedIn, isAdmin, onClose }: Props) {
  const t = useTranslations()
  const pathname = usePathname()
  const navGroups = useNavGroups()

  return (
    <div
      id="mobile-navigation-menu"
      role="navigation"
      aria-label={mainNavLabel}
      className="mobile-nav-sheet fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto overscroll-contain bg-[var(--bg-deep)] lg:hidden"
    >
      <div className={styles.groups}>
        {navGroups.map((group, index) => (
          <section key={group.label} aria-label={group.label} className={styles.group} style={{ '--i': index } as CSSProperties}>
            <h2 className={styles.heading}>{group.label}</h2>
            <div className={styles.items}>
              {group.items.map(item => {
                const active = isActiveHref(pathname, item.href)
                return (
                  <NavLink key={item.href} href={item.href} onClick={onClose} aria-current={active ? 'page' : undefined} className={`${styles.tile} ${focusRing}`}>
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
        {/* Support needs an account, so it sits with the account (the desktop avatar menu has it too). */}
        {isSignedIn && (
          <NavLink
            href="/support"
            onClick={onClose}
            aria-current={isActiveHref(pathname, '/support') ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-md px-3 text-[0.9375rem] text-[var(--text-secondary)] ${focusRing}`}
          >
            <MessageCircle size={17} aria-hidden="true" />{t('nav.support' as TranslationKey)}
          </NavLink>
        )}
        <div className="ml-auto flex items-center gap-1">
          <NavLink
            href="/calendar"
            onClick={onClose}
            aria-label={t('nav.other.calendar' as TranslationKey)}
            aria-current={isActiveHref(pathname, '/calendar') ? 'page' : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] aria-[current=page]:text-[var(--gold-light)] ${focusRing}`}
          >
            <CalendarIcon size={19} />
          </NavLink>
          <LanguageSwitcher up />
        </div>
        {isSignedIn ? (
          <NavLink
            href="/mypage"
            onClick={onClose}
            aria-label={t('mypage.title' as TranslationKey)}
            className={`flex min-h-11 items-center rounded-md px-1.5 ${focusRing}`}
          >
            <NavAvatar url={avatarUrl} size="2rem" />
          </NavLink>
        ) : (
          <>
          {sessionStatus === 'loading' && <span aria-hidden="true" className="nav-auth-user flex min-h-11 items-center px-1.5"><NavAvatar url={avatarUrl} size="2rem" /></span>}
          <NavLink
            href="/login"
            onClick={onClose}
            className={`flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[0.9375rem] text-[var(--text-secondary)] ${focusRing} ${sessionStatus === 'loading' ? 'nav-auth-guest' : ''}`}
          >
            {t('common.login' as TranslationKey)}
          </NavLink>
          </>
        )}
      </div>
      {isAdmin && (
        <NavLink
          href="/admin"
          onClick={onClose}
          className={`mx-4 mb-3 flex min-h-11 items-center rounded-md px-3 text-[0.875rem] text-[var(--text-tertiary)] ${focusRing}`}
        >
          관리
        </NavLink>
      )}
    </div>
  )
}
