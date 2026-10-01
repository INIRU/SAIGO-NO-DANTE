'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { ChevronDown, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname } from '@/lib/i18n/navigation'
import type { TranslationKey } from '@/lib/i18n/translations'
import PathnameBoundary from './PathnameBoundary'
import { NavLink, groupItem, isActiveHref, menuRow, navItem, panel, useNavGroups } from './nav-shared'

function Groups({ pathname }: { pathname: string | null }) {
  const groups = useNavGroups()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setOpenGroup(null) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <ul className="hidden lg:flex h-full items-stretch gap-1">
      {groups.map(group => {
        const isActive = group.items.some(i => isActiveHref(pathname, i.href))
        const open = openGroup === group.label
        return (
          <li
            key={group.label}
            className="relative flex items-center"
            onMouseEnter={() => {
              if (timerRef.current) clearTimeout(timerRef.current)
              setOpenGroup(group.label)
            }}
            onMouseLeave={() => {
              timerRef.current = setTimeout(() => setOpenGroup(null), 150)
            }}
          >
            <button
              type="button"
              onClick={() => setOpenGroup(open ? null : group.label)}
              aria-expanded={open}
              aria-haspopup="true"
              className={`${groupItem} cursor-pointer ${isActive ? 'text-[var(--gold)]' : open ? 'bg-[rgba(200,144,10,0.08)] text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`}
            >
              {group.label}
              <ChevronDown size={14} aria-hidden="true" className={`opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>
            {isActive && <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-0 z-0 h-0.5 rounded-full bg-[var(--gold)]" />}

            {open && (
              <div className="absolute left-0 top-full z-20 pt-1.5">
              <div role="menu" aria-label={group.label} className={`min-w-[10rem] ${panel}`}>
                {group.items.map(item => {
                  const active = isActiveHref(pathname, item.href)
                  return (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      aria-current={active ? 'page' : undefined}
                      className={`${menuRow} ${active ? 'text-[var(--gold)]' : 'text-[var(--text-secondary)]'}`}
                      onClick={() => setOpenGroup(null)}
                    >
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Desktop menu groups; the current group's underline and the dropdown's current page need the pathname. */
export function NavbarGroups() {
  return <PathnameBoundary>{pathname => <Groups pathname={pathname} />}</PathnameBoundary>
}

function SupportLink({ pathname, unread }: { pathname: string | null; unread: boolean }) {
  const t = useTranslations()
  const active = isActiveHref(pathname, '/support')
  return (
    <NavLink href="/support" data-testid="nav-support" aria-current={active ? 'page' : undefined} className={`${navItem} ${active ? 'text-[var(--gold)]' : 'text-[var(--text-secondary)]'}`}>
      <MessageCircle size={16} aria-hidden="true" />
      {unread && <span className="-ml-2.5 -mt-3.5 h-2 w-2 shrink-0 rounded-full bg-[var(--error)] ring-2 ring-[var(--bg-deep)]" role="img" aria-label={t('supportDesk.unread' as TranslationKey)} />}
      <span className="hidden xl:inline">{t('nav.support' as TranslationKey)}</span>
    </NavLink>
  )
}

export function NavbarSupportLink({ unread }: { unread: boolean }) {
  return <PathnameBoundary>{pathname => <SupportLink pathname={pathname} unread={unread} />}</PathnameBoundary>
}

function RouteWatcher({ onRoute }: { onRoute: () => void }) {
  const pathname = usePathname()
  useEffect(() => { onRoute() }, [pathname, onRoute])
  return null
}

/** Calls `onRoute` on mount and whenever the route changes; renders nothing, so waiting for the pathname shows nothing. */
export function NavbarRouteReset({ onRoute }: { onRoute: () => void }) {
  return <Suspense fallback={null}><RouteWatcher onRoute={onRoute} /></Suspense>
}
