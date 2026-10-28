'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { forgetPushSubscription } from '@/hooks/usePushSubscription'
import { useTapEgg } from '@/components/community/easterEggs'
import { useSession, signOut } from 'next-auth/react'
import { Menu, X, Search, CalendarDays } from 'lucide-react'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import DanteLogo from '@/components/brand/DanteLogo'
import { useTranslations } from 'next-intl'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useNotifications } from '@/hooks/useNotifications'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import type { Notification } from '@/lib/notifications'
import { toast } from '@/lib/toast'
import { NAV_AUTH_HINT_KEY } from '@/lib/constants/nav-boot'
import { NavAvatar, NavLink, focusRing, menuRow, navItem, panel } from './nav-shared'
import { NavbarGroups, NavbarRouteReset } from './NavbarIslands'
import NavNotifications, { NotificationToast, TOAST_FRAME, TOAST_LIFE_MS, sentenceOf } from './NavNotifications'
import NavbarMobileSheet from './NavbarMobileSheet'
import NavbarSearchModal from './NavbarSearchModal'

interface NavbarProps {
  mainNavLabel: string
}

export default function Navbar({ mainNavLabel }: NavbarProps) {
  const tapClock = useTapEgg('clock-head', 7)
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  // Hover/focus on the search button starts loading the modal chunk early (NavbarSearchModal).
  const [searchPreload, setSearchPreload] = useState(false)
  const lastScrollY = useRef(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const { data: session, status: sessionStatus } = useSession()

  // The server HTML never knows the session. Remember the last answer so the head script (AUTH_HINT_KEY in
  // app/[lang]/layout.tsx) can reserve the avatar slot on the next load instead of flashing the login button.
  useEffect(() => {
    if (sessionStatus === 'loading') return
    try {
      if (sessionStatus === 'authenticated') localStorage.setItem(NAV_AUTH_HINT_KEY, '1')
      else localStorage.removeItem(NAV_AUTH_HINT_KEY)
    } catch {}
  }, [sessionStatus])

  // 스크롤 숨김
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const current = window.scrollY
        const shouldHide = current > lastScrollY.current && current > 80
        lastScrollY.current = current
        setHidden(prev => prev === shouldHide ? prev : shouldHide)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 고정 목차·필터가 같은 타이밍에 따라오도록 숨김 상태를 <html>에 알린다 (--nav-offset, globals.css)
  useEffect(() => {
    document.documentElement.toggleAttribute('data-nav-hidden', hidden && !mobileMenuOpen && !notifyOpen)
  }, [hidden, mobileMenuOpen, notifyOpen])


  // 데스크탑 유저 메뉴 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 모바일 메뉴 body 스크롤 잠금
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  // 페이지를 옮기면 스크롤로 숨겨 둔 상태를 풀고 모바일 메뉴·검색을 닫는다 (경로는 NavbarRouteReset 섬이 읽는다)
  const resetOnRoute = useCallback(() => {
    setHidden(false)
    lastScrollY.current = window.scrollY
    setMobileMenuOpen(false)
    setSearchOpen(false)
    setNotifyOpen(false)
  }, [])

  // Cmd+K / Ctrl+K 검색 단축키, Esc로 메뉴 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setNotifyOpen(false)
        if (mobileMenuOpen) setMobileMenuOpen(false)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (mobileMenuOpen) setMobileMenuOpen(false)
        setSearchOpen(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mobileMenuOpen])

  const t = useTranslations()
  const tNotify = useTranslations('notifications')
  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null; isAdmin?: boolean; isWanjang?: boolean; isSuspended?: boolean } | undefined
  const supportUnread = useSupportUnread(!!user?.email && !user.isSuspended)
  // Comments on the user's posts and replies to their comments: a count on the bell, read once the panel is shown.
  // A new support reply counts as one more and leads the list until its thread is read.
  // New ones are also announced with a toast; pressing it opens the panel.
  const openNotifications = useRef(() => {})
  const notifications = useNotifications(!!user?.email && !user.isSuspended, (fresh: Notification[]) => {
    for (const item of [...fresh].reverse()) {
      const id = `notify-${item.id}`
      toast.custom(() => (
        <NotificationToast item={item} sentence={sentenceOf(item, tNotify)} closeLabel={tNotify('close')} onOpen={() => openNotifications.current()} onClose={() => toast.dismiss(id)} />
      ), { id, duration: TOAST_LIFE_MS, style: TOAST_FRAME })
    }
  })
  const closeNotifications = useCallback(() => setNotifyOpen(false), [])
  const toggleNotifications = () => {
    if (!notifyOpen) {
      void notifications.open()
      setMenuOpen(false)
      setMobileMenuOpen(false)
      // The panel opens where the toasts are: they have said what the list now shows.
      for (const item of notifications.items) toast.dismiss(`notify-${item.id}`)
    }
    setNotifyOpen(v => !v)
  }
  openNotifications.current = () => { if (!notifyOpen) toggleNotifications() }
  const bell = (mobile: boolean) => (
    <NavNotifications items={notifications.items} unread={notifications.unread + (supportUnread ? 1 : 0)} supportUnread={supportUnread} open={notifyOpen} onToggle={toggleNotifications} onClose={closeNotifications} mobile={mobile} />
  )
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const userEmail = user?.email

  // 프로필 아바타 가져오기
  useEffect(() => {
    if (!userEmail) { setProfileAvatar(null); setProfileName(null); setProfileLoaded(false); return }
    fetch('/api/profile/avatar')
      .then(r => r.json())
      .then(d => { setProfileAvatar(d.avatar_url); setProfileName(d.username ?? null) })
      .catch(() => {})
      .finally(() => setProfileLoaded(true))
  }, [userEmail])

  // 마이페이지에서 아바타·닉네임 변경 시 동기화
  useEffect(() => {
    const handler = (e: Event) => {
      setProfileAvatar((e as CustomEvent).detail)
    }
    const renamed = (e: Event) => setProfileName((e as CustomEvent<string>).detail)
    window.addEventListener('avatar-changed', handler)
    window.addEventListener('username-changed', renamed)
    return () => { window.removeEventListener('avatar-changed', handler); window.removeEventListener('username-changed', renamed) }
  }, [])

  // Until the profile answers, the circle stays empty rather than showing the default picture and swapping it.
  const avatarUrl = profileAvatar || (profileLoaded ? DEFAULT_AVATAR_URL : null)
  const displayName = profileName ?? ''

  const openMobileSearch = () => {
    setMobileMenuOpen(false)
    setSearchOpen(true)
  }

  return (
    <>
      <nav
        aria-label={mainNavLabel}
        className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--bg-deep)] transition-transform duration-300 motion-reduce:transition-none"
        style={{ transform: hidden && !mobileMenuOpen && !notifyOpen ? 'translateY(-100%)' : 'translateY(0)' }}
      >
        <div className="max-w-7xl mx-auto h-16 px-4 md:px-6 flex items-center gap-6 xl:gap-10">
          <NavLink
            href="/"
            onClick={tapClock}
            className={`flex shrink-0 items-center gap-2 rounded-md text-[1.0625rem] md:text-[1.1875rem] text-[var(--gold)] transition-colors hover:text-[var(--gold-light)] ${focusRing}`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <DanteLogo size="2.25rem" className="-ml-1 md:h-10 md:w-10" />
            {t('site.name' as TranslationKey)}
          </NavLink>

          {/* 데스크탑 메뉴 그룹: 현재 메뉴 표시만 경로가 필요해 따로 늦게 채운다 */}
          <NavbarGroups />

          <div className="ml-auto hidden lg:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              onPointerEnter={() => setSearchPreload(true)}
              onFocus={() => setSearchPreload(true)}
              aria-label="검색 열기 (Ctrl+K)"
              title="검색 (Ctrl+K)"
              className={`mr-1.5 flex h-9 w-40 xl:w-52 cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] pl-3 pr-2 text-[0.875rem] font-medium text-[var(--text-tertiary)] transition-colors duration-150 hover:border-[var(--border-hover)] hover:text-[var(--text-secondary)] ${searchOpen ? 'border-[var(--border-hover)]' : ''} ${focusRing}`}
            >
              <Search size={15} aria-hidden="true" className="text-[var(--gold)]" />
              <span className="flex-1 text-left">{t('common.search' as TranslationKey)}</span>
              <kbd aria-hidden="true" className="rounded px-1 text-[0.75rem] font-medium [font-family:var(--font-body)] text-[var(--text-tertiary)]">
                {/* html[data-mac] is set by the head script before paint, so the hint never swaps after hydration. */}
                <span className="nav-kbd-mac">⌘K</span><span className="nav-kbd-other">Ctrl K</span>
              </kbd>
            </button>

            {/* 소식 캘린더: 메뉴 묶음에 넣지 않고 언어 버튼 옆의 아이콘으로 둔다 */}
            <NavLink
              href="/calendar"
              aria-label={t('nav.other.calendar' as TranslationKey)}
              title={t('nav.other.calendar' as TranslationKey)}
              className={`flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[rgba(200,144,10,0.06)] hover:text-[var(--gold-light)] ${focusRing}`}
            >
              <CalendarDays size={17} aria-hidden="true" />
            </NavLink>
            <LanguageSwitcher compact />

            {user ? (
              <div className="ml-1.5 flex items-center gap-2 border-l border-[var(--border)] pl-2">
              {bell(false)}
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(v => !v)}
                  aria-label="사용자 메뉴 열기"
                  aria-expanded={menuOpen}
                  className={`flex cursor-pointer items-center rounded-full transition-opacity hover:opacity-85 ${focusRing}`}
                >
                  {<NavAvatar url={avatarUrl} size="2.25rem" />}
                </button>

                {menuOpen && (
                  <div className={`absolute right-0 top-[calc(100%+0.625rem)] z-20 w-52 ${panel}`}>
                    <div className="px-3 pt-2 pb-2.5 mb-1 border-b border-[var(--border)]">
                      <p className="truncate text-[0.875rem] font-medium text-[var(--text-primary)]">{displayName}</p>
                      {user.email && <p className="truncate text-[0.75rem] text-[var(--text-muted)] mt-0.5">{user.email}</p>}
                    </div>
                    <NavLink href="/mypage" onClick={() => setMenuOpen(false)} className={`${menuRow} text-[var(--text-secondary)]`}>
                      {t('mypage.title' as TranslationKey)}
                    </NavLink>
                    <NavLink href="/support" onClick={() => setMenuOpen(false)} className={`${menuRow} text-[var(--text-secondary)]`}>
                      {t('nav.support' as TranslationKey)}
                    </NavLink>
                    {user.isAdmin && (
                      <NavLink href="/admin" onClick={() => setMenuOpen(false)} className={`${menuRow} text-[var(--text-secondary)]`}>
                        관리
                      </NavLink>
                    )}
                    <button
                      type="button"
                      onClick={() => { void forgetPushSubscription().finally(() => signOut({ callbackUrl: '/' })); setMenuOpen(false) }}
                      className={`${menuRow} w-full cursor-pointer text-left text-[var(--text-tertiary)]`}
                    >
                      {t('common.logout' as TranslationKey)}
                    </button>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <>
                {sessionStatus === 'loading' && (
                  <span aria-hidden="true" className="nav-auth-user ml-1.5 flex items-center gap-2 border-l border-[var(--border)] pl-2">
                    <span data-testid="nav-notify-slot" className="h-9 w-9" />
                    <NavAvatar url={avatarUrl} size="2.25rem" />
                  </span>
                )}
                <NavLink href="/login" className={`${navItem} ml-1.5 border border-[var(--border)] text-[var(--text-secondary)] ${sessionStatus === 'loading' ? 'nav-auth-guest' : ''}`}>
                  {t('common.login' as TranslationKey)}
                </NavLink>
              </>
            )}
          </div>

          {/* 모바일: 검색 + 메뉴 */}
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <button
              type="button"
              onClick={openMobileSearch}
              aria-label={`${t('common.search' as TranslationKey)} 열기`}
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] ${focusRing}`}
            >
              <Search size={20} aria-hidden="true" />
            </button>
            {user ? bell(true) : sessionStatus === 'loading' && <span aria-hidden="true" data-testid="nav-notify-slot" className="nav-auth-user h-11 w-11" />}
            <button
              type="button"
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-[var(--gold-light)] ${focusRing}`}
              onClick={() => { setNotifyOpen(false); setMobileMenuOpen(v => !v) }}
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <Suspense fallback={null}>
          <NavbarMobileSheet
            mainNavLabel={mainNavLabel}
            sessionStatus={sessionStatus}
            avatarUrl={avatarUrl}
            isSignedIn={!!user}
            isAdmin={!!user?.isAdmin}
            onClose={() => setMobileMenuOpen(false)}
          />
        </Suspense>
      )}

      <style>{'@keyframes nav-pop{from{opacity:0;transform:translateY(-0.25rem)}}.nav-pop{animation:nav-pop 140ms ease-out}@media (prefers-reduced-motion:reduce){.nav-pop{animation:none}}'}</style>

      {/* 전역 검색 모달 */}
      <NavbarSearchModal open={searchOpen} preload={searchPreload} onClose={() => setSearchOpen(false)} />
      <NavbarRouteReset onRoute={resetOnRoute} />
    </>
  )
}
