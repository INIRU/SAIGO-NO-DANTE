'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { useTapEgg } from '@/components/community/easterEggs'
import Image from 'next/image'
import { usePathname } from '@/lib/i18n/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Menu, X, ChevronDown, Search, MessageCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
const SearchModal = dynamic(() => import('@/components/ui/SearchModal'))
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import DanteLogo from '@/components/brand/DanteLogo'
import { useTranslations } from 'next-intl'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import { NAV_AUTH_HINT_KEY } from '@/lib/constants/nav-boot'

const NAV_GROUPS: { labelKey: string; items: { href: string; labelKey: string }[] }[] = [
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
      { href: '/collection',          labelKey: 'nav.community.collection' },
    ],
  },
  {
    labelKey: 'nav.tools.title',
    items: [{ href: '/tools/experience', labelKey: 'nav.tools.experience' }, { href: '/tools/lunacy', labelKey: 'nav.tools.lunacy' }],
  },
  {
    labelKey: 'nav.other.title',
    items: [
      { href: '/developers', labelKey: 'nav.other.developers' },
      { href: '/meta',       labelKey: 'nav.other.meta' },
      { href: '/random',     labelKey: 'nav.other.random' },
    ],
  },
]

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)]'
// 데스크탑 상단 항목 공통: 같은 높이(h-9), hover는 사이트 금색
const navBase = `flex h-9 items-center gap-1.5 rounded-md px-3 whitespace-nowrap transition-colors duration-150 hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--gold-light)] ${focusRing}`
// 메뉴 그룹: 제목 서체(Kotra), 오른쪽 도구(문의·언어·로그인): 본문 서체
const groupItem = `${navBase} [font-family:var(--font-heading)] text-[0.9375rem] tracking-[0.01em]`
const navItem = `${navBase} text-[0.875rem] font-medium`
const menuRow = `block rounded-[0.3125rem] px-3 py-2 text-[0.875rem] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-[rgba(200,144,10,0.08)] hover:text-[var(--gold-light)] ${focusRing}`
// 메뉴는 트리거 바로 아래에 붙고 제자리에서 살짝 내려오기만 한다 (가로 이동 없음)
const panel = 'nav-pop rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[var(--shadow-lg)]'

interface NavbarProps {
  mainNavLabel: string
}

export default function Navbar({ mainNavLabel }: NavbarProps) {
  const tapClock = useTapEgg('clock-head', 7)
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  // The search modal's chunk loads after the page is idle (or on the first hover/open) instead of with every page. It is
  // mounted closed first and opened a frame later, so even the first open plays the enter animation.
  const [searchMounted, setSearchMounted] = useState(false)
  const [searchReady, setSearchReady] = useState(false)
  if (searchOpen && !searchMounted) setSearchMounted(true)
  const preloadSearch = () => setSearchMounted(true)
  useEffect(() => {
    if (searchMounted) return
    const idle = window.requestIdleCallback?.(() => setSearchMounted(true), { timeout: 3000 })
    const timer = idle === undefined ? window.setTimeout(() => setSearchMounted(true), 2000) : undefined
    return () => { if (idle !== undefined) window.cancelIdleCallback(idle); else window.clearTimeout(timer) }
  }, [searchMounted])
  useEffect(() => {
    if (!searchMounted) return
    let frame = 0
    void import('@/components/ui/SearchModal').then(() => {
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setSearchReady(true)) })
    })
    return () => cancelAnimationFrame(frame)
  }, [searchMounted])
  const lastScrollY = useRef(0)
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)
  const groupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    document.documentElement.toggleAttribute('data-nav-hidden', hidden && !mobileMenuOpen)
  }, [hidden, mobileMenuOpen])

  // 페이지를 옮기면 스크롤로 숨겨 둔 상태를 풀어 준다
  useEffect(() => {
    setHidden(false)
    lastScrollY.current = window.scrollY
  }, [pathname])

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

  // 경로 변경 시 모바일 메뉴 닫기
  useEffect(() => {
    setMobileMenuOpen(false)
    setSearchOpen(false)
    setOpenGroup(null)
  }, [pathname])

  // Cmd+K / Ctrl+K 검색 단축키, Esc로 메뉴 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenGroup(null)
        setMenuOpen(false)
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
  // next-intl Link handles locale prefix automatically
  const navGroups = useMemo(() => NAV_GROUPS.map(g => ({
    label: t(g.labelKey as TranslationKey),
    items: g.items.map(item => ({
      href: item.href,
      label: t(item.labelKey as TranslationKey),
    })),
  })), [t])

  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null; isAdmin?: boolean; isWanjang?: boolean; isSuspended?: boolean } | undefined
  const supportUnread = useSupportUnread(!!user?.email && !user.isSuspended)
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

  // Strip lang prefix from pathname so active-state checks work regardless of prefix
  const strippedPathname = pathname.replace(/^\/(ko|en|ja)(?=\/|$)/, '') || '/'

  const isActiveHref = (href: string) => strippedPathname === href || strippedPathname?.startsWith(href + '/')

  const openMobileSearch = () => {
    setMobileMenuOpen(false)
    setSearchOpen(true)
  }

  const avatar = (size: string) => (
    <span className="relative block shrink-0 overflow-hidden rounded-full border border-[var(--gold-dim)] bg-[var(--bg-card)]" style={{ width: size, height: size }}>
      {avatarUrl && <Image src={avatarUrl} alt="" fill sizes="32px" style={{ objectFit: 'cover' }} />}
    </span>
  )

  return (
    <>
      <nav
        aria-label={mainNavLabel}
        className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--bg-deep)] transition-transform duration-300 motion-reduce:transition-none"
        style={{ transform: hidden && !mobileMenuOpen ? 'translateY(-100%)' : 'translateY(0)' }}
      >
        <div className="max-w-7xl mx-auto h-16 px-4 md:px-6 flex items-center gap-6 xl:gap-10">
          <Link
            href="/"
            onClick={tapClock}
            className={`flex shrink-0 items-center gap-2 rounded-md text-[1.0625rem] md:text-[1.1875rem] text-[var(--gold)] transition-colors hover:text-[var(--gold-light)] ${focusRing}`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            <DanteLogo size="2.25rem" className="-ml-1 md:h-10 md:w-10" />
            {t('site.name' as TranslationKey)}
          </Link>

          {/* 데스크탑 메뉴 그룹 */}
          <ul className="hidden lg:flex h-full items-stretch gap-1">
            {navGroups.map(group => {
              const isActive = group.items.some(i => isActiveHref(i.href))
              const open = openGroup === group.label
              return (
                <li
                  key={group.label}
                  className="relative flex items-center"
                  onMouseEnter={() => {
                    if (groupTimerRef.current) clearTimeout(groupTimerRef.current)
                    setOpenGroup(group.label)
                  }}
                  onMouseLeave={() => {
                    groupTimerRef.current = setTimeout(() => setOpenGroup(null), 150)
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
                        const active = isActiveHref(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            aria-current={active ? 'page' : undefined}
                            className={`${menuRow} ${active ? 'text-[var(--gold)]' : 'text-[var(--text-secondary)]'}`}
                            onClick={() => setOpenGroup(null)}
                          >
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="ml-auto hidden lg:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              onPointerEnter={preloadSearch}
              onFocus={preloadSearch}
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

            <Link href="/support" data-testid="nav-support" aria-current={isActiveHref('/support') ? 'page' : undefined} className={`${navItem} ${isActiveHref('/support') ? 'text-[var(--gold)]' : 'text-[var(--text-secondary)]'}`}>
              <MessageCircle size={16} aria-hidden="true" />
              {supportUnread && <span className="-ml-2.5 -mt-3.5 h-2 w-2 shrink-0 rounded-full bg-[var(--error)] ring-2 ring-[var(--bg-deep)]" role="img" aria-label={t('supportDesk.unread' as TranslationKey)} />}
              <span className="hidden xl:inline">{t('nav.support' as TranslationKey)}</span>
            </Link>
            <LanguageSwitcher />

            {user ? (
              <div ref={menuRef} className="relative ml-1.5 border-l border-[var(--border)] pl-3">
                <button
                  type="button"
                  onClick={() => setMenuOpen(v => !v)}
                  aria-label="사용자 메뉴 열기"
                  aria-expanded={menuOpen}
                  className={`flex cursor-pointer items-center rounded-full transition-opacity hover:opacity-85 ${focusRing}`}
                >
                  {avatar('2.25rem')}
                </button>

                {menuOpen && (
                  <div className={`absolute right-0 top-[calc(100%+0.625rem)] z-20 w-52 ${panel}`}>
                    <div className="px-3 pt-2 pb-2.5 mb-1 border-b border-[var(--border)]">
                      <p className="truncate text-[0.875rem] font-medium text-[var(--text-primary)]">{displayName}</p>
                      {user.email && <p className="truncate text-[0.75rem] text-[var(--text-muted)] mt-0.5">{user.email}</p>}
                    </div>
                    <Link href="/mypage" onClick={() => setMenuOpen(false)} className={`${menuRow} text-[var(--text-secondary)]`}>
                      {t('mypage.title' as TranslationKey)}
                    </Link>
                    {user.isAdmin && (
                      <Link href="/admin" onClick={() => setMenuOpen(false)} className={`${menuRow} text-[var(--text-secondary)]`}>
                        관리
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => { signOut({ callbackUrl: '/' }); setMenuOpen(false) }}
                      className={`${menuRow} w-full cursor-pointer text-left text-[var(--text-tertiary)]`}
                    >
                      {t('common.logout' as TranslationKey)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {sessionStatus === 'loading' && (
                  <span aria-hidden="true" className="nav-auth-user ml-1.5 border-l border-[var(--border)] pl-3">{avatar('2.25rem')}</span>
                )}
                <Link href="/login" className={`${navItem} ml-1.5 border border-[var(--border)] text-[var(--text-secondary)] ${sessionStatus === 'loading' ? 'nav-auth-guest' : ''}`}>
                  {t('common.login' as TranslationKey)}
                </Link>
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
            <button
              type="button"
              className={`relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-[var(--gold-light)] ${focusRing}`}
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              {supportUnread && !mobileMenuOpen && <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--error)] ring-2 ring-[var(--bg-deep)]" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          role="navigation"
          aria-label={mainNavLabel}
          className="mobile-nav-sheet fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto overscroll-contain bg-[var(--bg-deep)] lg:hidden"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-4 pt-5 pb-6">
            {navGroups.map(group => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="mb-1 px-3 text-[0.875rem] text-[var(--gold)]" style={{ fontFamily: 'var(--font-heading)' }}>{group.label}</h2>
                {group.items.map(item => {
                  const active = isActiveHref(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex min-h-11 items-center rounded-md px-3 text-[0.9375rem] font-medium ${focusRing} ${active ? 'bg-[rgba(200,144,10,0.08)] text-[var(--gold-light)]' : 'text-[var(--text-primary)]'}`}
                    >
                      {active && <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--gold)]" />}
                      {item.label}
                    </Link>
                  )
                })}
              </section>
            ))}
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
            <Link
              href="/support"
              data-testid="nav-support-mobile"
              onClick={() => setMobileMenuOpen(false)}
              aria-current={isActiveHref('/support') ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-md px-3 text-[0.9375rem] text-[var(--text-secondary)] ${focusRing}`}
            >
              <MessageCircle size={17} aria-hidden="true" />{t('nav.support' as TranslationKey)}
              {supportUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--error)] ring-2 ring-[var(--bg-deep)]" role="img" aria-label={t('supportDesk.unread' as TranslationKey)} />}
            </Link>
            <div className="ml-auto">
              <LanguageSwitcher up />
            </div>
            {user ? (
              <Link
                href="/mypage"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={t('mypage.title' as TranslationKey)}
                className={`flex min-h-11 items-center rounded-md px-1.5 ${focusRing}`}
              >
                {avatar('2rem')}
              </Link>
            ) : (
              <>
              {sessionStatus === 'loading' && <span aria-hidden="true" className="nav-auth-user flex min-h-11 items-center px-1.5">{avatar('2rem')}</span>}
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex min-h-11 items-center rounded-md border border-[var(--border)] px-3 text-[0.9375rem] text-[var(--text-secondary)] ${focusRing} ${sessionStatus === 'loading' ? 'nav-auth-guest' : ''}`}
              >
                {t('common.login' as TranslationKey)}
              </Link>
              </>
            )}
          </div>
          {user?.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`mx-4 mb-3 flex min-h-11 items-center rounded-md px-3 text-[0.875rem] text-[var(--text-tertiary)] ${focusRing}`}
            >
              관리
            </Link>
          )}
        </div>
      )}

      <style>{'@keyframes nav-pop{from{opacity:0;transform:translateY(-0.25rem)}}.nav-pop{animation:nav-pop 140ms ease-out}@media (prefers-reduced-motion:reduce){.nav-pop{animation:none}}'}</style>

      {/* 전역 검색 모달 */}
      {searchMounted && <SearchModal open={searchOpen && searchReady} onClose={() => setSearchOpen(false)} />}
    </>
  )
}
