'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { usePathname } from '@/lib/i18n/navigation'
import { useSession, signOut } from 'next-auth/react'
import { CalendarDays, Menu, X, ChevronDown, Search } from 'lucide-react'
import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'motion/react'
const SearchModal = dynamic(() => import('@/components/ui/SearchModal'), { ssr: false })
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { useTranslations } from 'next-intl'
import type { TranslationKey } from '@/lib/i18n/translations'

type NavGroupDef = {
  labelKey: string
  items: { href: string; labelKey: string; icon?: 'calendar' }[]
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    labelKey: 'nav.story.title',
    items: [
      { href: '/story', labelKey: 'nav.story.main' },
    ],
  },
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
      { href: '/tier-list',           labelKey: 'nav.community.tierList' },
      { href: '/collection',          labelKey: 'nav.community.collection' },
    ],
  },
  {
    labelKey: 'nav.other.title',
    items: [
      { href: '/calendar',   labelKey: 'nav.calendar', icon: 'calendar' },
      { href: '/meta',       labelKey: 'nav.other.meta' },
      { href: '/extraction', labelKey: 'nav.other.extraction' },
      { href: '/random',     labelKey: 'nav.other.random' },
    ],
  },
]


interface NavbarProps {
  mainNavLabel: string
}

export default function Navbar({ mainNavLabel }: NavbarProps) {
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [openMobileGroups, setOpenMobileGroups] = useState<string[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    setIsMac(/Mac|iPhone/.test(navigator.userAgent))
  }, [])
  const lastScrollY = useRef(0)
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)
  const groupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: session } = useSession()

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
  }, [pathname])

  // Cmd+K / Ctrl+K 검색 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false)
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
      icon: item.icon,
    })),
  })), [t])

  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null; isAdmin?: boolean; isWanjang?: boolean; isSuspended?: boolean } | undefined
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null)
  const userEmail = user?.email

  // 프로필 아바타 가져오기
  useEffect(() => {
    if (!userEmail) { setProfileAvatar(null); return }
    fetch('/api/profile/avatar')
      .then(r => r.json())
      .then(d => setProfileAvatar(d.avatar_url))
      .catch(() => {})
  }, [userEmail])

  // 마이페이지에서 아바타 변경 시 동기화
  useEffect(() => {
    const handler = (e: Event) => {
      setProfileAvatar((e as CustomEvent).detail)
    }
    window.addEventListener('avatar-changed', handler)
    return () => window.removeEventListener('avatar-changed', handler)
  }, [])

  const avatarUrl = profileAvatar || DEFAULT_AVATAR_URL
  const displayName = user?.name ?? user?.email ?? ''
  const accountInitial = (displayName || user?.email || t('mypage.title' as TranslationKey)).trim()[0]?.toUpperCase() ?? 'M'

  // Strip lang prefix from pathname so active-state checks work regardless of prefix
  const strippedPathname = pathname.replace(/^\/(ko|en|ja)(?=\/|$)/, '') || '/'

  const isActiveHref = (href: string) => strippedPathname === href || strippedPathname?.startsWith(href + '/')
  const calendarNavLabel = t('nav.calendar' as TranslationKey)

  useEffect(() => {
    if (!mobileMenuOpen) return

    const activeGroup = navGroups.find(group => group.items.some(item => isActiveHref(item.href)))
    if (!activeGroup || activeGroup.items.length === 1) return
    setOpenMobileGroups(prev => prev.includes(activeGroup.label) ? prev : [...prev, activeGroup.label])
  }, [mobileMenuOpen, navGroups, strippedPathname])

  const openMobileSearch = () => {
    setMobileMenuOpen(false)
    setSearchOpen(true)
  }

  const toggleMobileGroup = (label: string) => {
    setOpenMobileGroups(prev => (
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    ))
  }

  const mobileDrawerMaxHeight = 'min(28rem, calc(100dvh - 5rem))'
  const mobileNavListMaxHeight = 'min(24.375rem, calc(100dvh - 8.625rem))'
  const mobileRowBaseStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '2.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0 1rem',
    fontFamily: 'var(--font-heading)',
    fontSize: '0.9375rem',
    fontWeight: 400,
    lineHeight: 1.3,
    color: 'var(--text-secondary)',
    borderBottom: '0',
    background: 'transparent',
    cursor: 'pointer',
  }

  const mobileLinkRowStyle = (href: string, nested = false): CSSProperties => ({
    ...mobileRowBaseStyle,
    paddingLeft: nested ? '2rem' : '1rem',
    color: isActiveHref(href) ? 'var(--gold)' : 'var(--text-secondary)',
    background: isActiveHref(href) ? 'rgba(200,144,10,0.055)' : 'transparent',
  })

  const mobileUtilityActionStyle: CSSProperties = {
    minHeight: '2.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0 0.75rem',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-heading)',
    fontSize: '0.9375rem',
    fontWeight: 400,
    background: 'transparent',
    border: '0',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  const mobileUtilityChipStyle: CSSProperties = {
    ...mobileUtilityActionStyle,
    minHeight: '2.75rem',
    padding: '0 0.625rem',
    border: '0.0625rem solid rgba(200,144,10,0.12)',
    background: 'rgba(200,144,10,0.035)',
  }

  return (
    <>
      <nav
        aria-label={mainNavLabel}
        className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300"
        style={{
          transform: hidden && !mobileMenuOpen ? 'translateY(-100%)' : 'translateY(0)',
          background: 'linear-gradient(to bottom, rgba(10,8,5,0.98), rgba(10,8,5,0.85))',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(58,42,21,0.7)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-[64px] flex items-center justify-between">
          {/* 로고 — 모바일 축소 */}
          <Link
            href="/"
            className="flex items-center gap-0 tracking-wider transition-colors hover:text-yellow-300 text-[1.0625rem] md:text-[1.25rem]"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-kotra-bold), var(--font-heading)' }}
          >
            <Image src="/images/logo.webp" alt="" width={42} height={42} unoptimized className="w-[34px] md:w-[42px] h-auto -ml-2" />
            {t('site.name' as TranslationKey)}
          </Link>

          {/* 데스크탑 네비게이션 — 드롭다운 그룹 */}
          <div className="hidden md:flex items-center gap-5">
            {navGroups.map(group => {
              const isActive = group.items.some(i => strippedPathname === i.href || strippedPathname?.startsWith(i.href + '/'))
              const isSingleItem = group.items.length === 1

              // 아이템 1개 → 바로 이동
              if (isSingleItem) {
                return (
                  <Link
                    key={group.label}
                    href={`${group.items[0].href}`}
                    className="font-compact-serif-label flex items-center transition-colors duration-200 hover:text-yellow-300"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.9375rem',
                      fontWeight: 400,
                      color: isActive ? 'var(--gold)' : '#a08a60',
                      padding: '0.25rem 0',
                    }}
                  >
                    {group.label}
                  </Link>
                )
              }

              return (
                <div
                  key={group.label}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => {
                    if (groupTimerRef.current) clearTimeout(groupTimerRef.current)
                    setOpenGroup(group.label)
                  }}
                  onMouseLeave={() => {
                    groupTimerRef.current = setTimeout(() => setOpenGroup(null), 150)
                  }}
                >
                  <button
                    aria-expanded={openGroup === group.label}
                    aria-haspopup="true"
                    className="font-compact-serif-label flex items-center gap-1 transition-colors duration-200 hover:text-yellow-300"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.9375rem',
                      fontWeight: 400,
                      color: isActive ? 'var(--gold)' : '#a08a60',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '0.25rem 0',
                    }}
                  >
                    {group.label}
                    <ChevronDown size={12} style={{
                      opacity: 0.5,
                      transform: openGroup === group.label ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                    }} />
                  </button>

                  {openGroup === group.label && (
                    <div role="menu" aria-label={`${group.label} 메뉴`} className="animate-dropdown-in" style={{
                      position: 'absolute',
                      top: 'calc(100% + 12px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(to bottom, var(--bg-card), #15120d)',
                      border: '1px solid rgba(200,144,10,0.12)',
                      borderRadius: 'var(--radius-md)',
                      minWidth: '130px',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 1px rgba(200,144,10,0.15)',
                      overflow: 'hidden',
                      padding: '0.25rem 0',
                    }}>
                      {/* 상단 골드 라인 */}
                      <div style={{
                        position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px',
                        background: 'linear-gradient(to right, transparent, rgba(200,144,10,0.3), transparent)',
                      }} />
                      {group.items.map(item => {
                        const active = strippedPathname === item.href || strippedPathname?.startsWith(item.href + '/')
                        return (
                          <Link
                            key={item.href}
                            href={`${item.href}`}
                            role="menuitem"
                            className="font-compact-serif-label block transition-all duration-150"
                            style={{
                              padding: '0.625rem 1.25rem',
                              fontFamily: 'var(--font-heading)',
                              fontSize: '0.9375rem',
                              fontWeight: 400,
                              color: active ? 'var(--gold)' : 'var(--text-tertiary)',
                              whiteSpace: 'nowrap',
                              background: active ? 'rgba(200,144,10,0.06)' : 'transparent',
                              borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                            }}
                            onMouseEnter={e => {
                              if (!active) {
                                e.currentTarget.style.color = '#c8a050'
                                e.currentTarget.style.background = 'rgba(200,144,10,0.04)'
                              }
                            }}
                            onMouseLeave={e => {
                              if (!active) {
                                e.currentTarget.style.color = 'var(--text-tertiary)'
                                e.currentTarget.style.background = 'transparent'
                              }
                            }}
                            onClick={() => setOpenGroup(null)}
                          >
                            {item.icon === 'calendar' && (
                              <CalendarDays
                                size={14}
                                aria-hidden="true"
                                style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: '-0.125rem', color: active ? 'var(--gold)' : 'var(--gold-dim)' }}
                              />
                            )}
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            <Link
              href="/calendar"
              aria-label={calendarNavLabel}
              title={calendarNavLabel}
              className="nav-calendar-shortcut relative flex h-10 w-10 items-center justify-center rounded-md transition-[background-color,box-shadow,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08]"
              style={{
                color: isActiveHref('/calendar') ? 'var(--gold)' : 'var(--text-tertiary)',
                background: isActiveHref('/calendar') ? 'rgba(200,144,10,0.07)' : 'transparent',
                boxShadow: isActiveHref('/calendar') ? 'inset 0 -0.0625rem rgba(232,176,48,0.42)' : 'none',
              }}
            >
              <CalendarDays className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </Link>

            <LanguageSwitcher />

            {/* 검색 버튼 */}
            <motion.button
              onClick={() => setSearchOpen(true)}
              data-open={searchOpen}
              aria-label="검색 열기 (Ctrl+K)"
              className="nav-search-trigger flex min-h-9 items-center gap-1.5 rounded-md px-2.5 py-1 transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0b08]"
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { y: 0, scale: 0.985 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                border: `1px solid ${searchOpen ? 'rgba(232,176,48,0.32)' : 'rgba(200,144,10,0.16)'}`,
                background: searchOpen ? 'rgba(200,144,10,0.1)' : 'rgba(18,14,9,0.62)',
              }}
              title="검색 (Ctrl+K)"
            >
              <Search size={14} style={{ opacity: 0.72 }} aria-hidden="true" />
              <span className="font-compact-serif-label" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1 }}>{t('common.search' as TranslationKey)}</span>
              <div className="hidden items-center gap-0.5 sm:flex" style={{ marginLeft: '0.125rem' }} aria-hidden="true">
                <kbd style={{
                  padding: '0.0625rem 0.25rem',
                  fontSize: '0.6875rem',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#6a5838',
                  background: 'rgba(200,144,10,0.06)',
                  border: '1px solid rgba(200,144,10,0.14)',
                  borderRadius: 4,
                  boxShadow: 'none',
                  lineHeight: '1.2',
                  fontWeight: 500,
                }}>
                  {isMac ? '⌘' : 'Ctrl'}
                </kbd>
                <kbd style={{
                  padding: '0.0625rem 0.25rem',
                  fontSize: '0.6875rem',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#6a5838',
                  background: 'rgba(200,144,10,0.06)',
                  border: '1px solid rgba(200,144,10,0.14)',
                  borderRadius: 4,
                  boxShadow: 'none',
                  lineHeight: '1.2',
                  fontWeight: 500,
                }}>
                  K
                </kbd>
              </div>
            </motion.button>

            {/* 데스크탑 로그인 / 유저 메뉴 */}
            {user ? (
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  aria-label="사용자 메뉴 열기"
                  className="flex items-center gap-2 transition-opacity hover:opacity-80"
                  style={{ cursor: 'pointer' }}
                >
                  {avatarUrl ? (
                    <div style={{ width: '1.875rem', height: '1.875rem', borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '1.5px solid var(--gold-dim)' }}>
                      <Image src={avatarUrl} alt="" fill sizes="30px" style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: '1.875rem', height: '1.875rem', borderRadius: '50%',
                      background: 'rgba(200,144,10,0.15)',
                      border: '1.5px solid var(--gold-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 'bold',
                    }}>
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                </button>

                {menuOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 10px)',
                    background: '#1a1510', border: '1px solid var(--border)',
                    borderRadius: '6px', minWidth: '160px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ color: '#c8a450', fontSize: '0.8125rem', fontWeight: 600, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </p>
                      {user.email && (
                        <p style={{ color: '#999', fontSize: '0.6875rem', marginTop: '0.125rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.email}
                        </p>
                      )}
                    </div>
                    <Link
                      href="/mypage"
                      onClick={() => setMenuOpen(false)}
                      className="block w-full text-left transition-colors hover:bg-white/5"
                      style={{ padding: '0.625rem 0.875rem', color: '#666677', fontSize: '0.8125rem' }}
                    >
                      {t('mypage.title' as TranslationKey)}
                    </Link>
                    {user.isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-left transition-colors hover:bg-white/5"
                        style={{ padding: '0.625rem 0.875rem', color: '#666677', fontSize: '0.8125rem' }}
                      >
                        관리
                      </Link>
                    )}
                    <button
                      onClick={() => { signOut({ callbackUrl: '/' }); setMenuOpen(false) }}
                      className="w-full text-left transition-colors hover:bg-white/5"
                      style={{ padding: '0.625rem 0.875rem', color: '#666677', fontSize: '0.8125rem', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
                    >
                      {t('common.logout' as TranslationKey)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 transition-all duration-200 hover:opacity-80"
                style={{
                  fontSize: '0.8125rem', color: '#888899',
                  border: '1px solid #555570', borderRadius: '4px',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                {t('common.login' as TranslationKey)}
              </Link>
            )}
          </div>

          {/* 모바일 햄버거 버튼 */}
          <button
            className="md:hidden flex items-center justify-center"
            onClick={() => setMobileMenuOpen(v => !v)}
            style={{ color: 'var(--gold)', cursor: 'pointer', padding: '0.25rem' }}
            aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="fixed left-0 right-0 z-40 md:hidden"
          role="navigation"
          aria-label={mainNavLabel}
          style={{
            top: '4rem',
            maxHeight: mobileDrawerMaxHeight,
            overflow: 'visible',
            background: '#0d0b08',
            backdropFilter: 'none',
            boxShadow: '0 0.75rem 1.5rem rgba(0,0,0,0.46)',
            transform: 'translateY(-0.25rem)',
            animation: 'mobile-drawer-enter 120ms ease-out forwards',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <style>{`
            @keyframes mobile-drawer-enter {
              from { opacity: 0; transform: translateY(-0.25rem); }
              to { opacity: 1; transform: translateY(0); }
            }
            @media (prefers-reduced-motion: reduce) {
              #mobile-navigation-menu { animation: none !important; transform: none !important; }
            }
            #mobile-navigation-menu [data-mobile-language-switcher] {
              opacity: 1 !important;
            }
            #mobile-navigation-menu [data-mobile-language-switcher] button[aria-haspopup="listbox"] {
              background: #14100c !important;
              border-color: rgba(200,144,10,0.28) !important;
            }
            #mobile-navigation-menu [data-mobile-language-switcher] [role="listbox"] {
              background-color: #14100c !important;
              background-image: linear-gradient(180deg, #16110d 0%, #0d0b08 100%) !important;
              box-shadow: 0 0.875rem 2rem rgba(0,0,0,0.68), 0 0 0 0.0625rem rgba(200,144,10,0.1) !important;
            }
          `}</style>
          <div
            style={{
              maxHeight: mobileDrawerMaxHeight,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
            }}
          >
            <div
              style={{
                minHeight: 0,
                flex: '1 1 auto',
                maxHeight: mobileNavListMaxHeight,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                padding: '0.25rem 0',
              }}
            >
              {navGroups.map(group => {
                const groupActive = group.items.some(item => isActiveHref(item.href))
                const isSingleItem = group.items.length === 1
                const expanded = openMobileGroups.includes(group.label)

                if (isSingleItem) {
                  const item = group.items[0]
                  const active = isActiveHref(item.href)

                  return (
                    <Link
                      key={group.label}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="transition-colors duration-150"
                      style={mobileLinkRowStyle(item.href)}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '0.625rem',
                            bottom: '0.625rem',
                            width: '0.125rem',
                            background: 'var(--gold)',
                          }}
                        />
                      )}
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.label}
                      </span>
                    </Link>
                  )
                }

                return (
                  <div key={group.label}>
                    <button
                      type="button"
                      onClick={() => toggleMobileGroup(group.label)}
                      aria-expanded={expanded}
                      className="transition-colors duration-150"
                      style={{
                        ...mobileRowBaseStyle,
                        color: groupActive ? 'var(--gold)' : 'var(--text-secondary)',
                        background: groupActive ? 'rgba(200,144,10,0.045)' : 'transparent',
                      }}
                    >
                      {groupActive && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '0.625rem',
                            bottom: '0.625rem',
                            width: '0.125rem',
                            background: 'var(--gold)',
                          }}
                        />
                      )}
                      <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                        {group.label}
                      </span>
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        style={{
                          flexShrink: 0,
                          color: groupActive ? 'var(--gold)' : 'var(--text-tertiary)',
                          opacity: 0.72,
                          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                          transition: 'transform 120ms ease-out',
                        }}
                      />
                    </button>
                    {expanded && (
                      <div
                        style={{
                          padding: '0.125rem 0 0.25rem',
                          background: 'rgba(255,255,255,0.012)',
                        }}
                      >
                        {group.items.map(item => {
                          const active = isActiveHref(item.href)

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="transition-colors duration-150"
                              style={mobileLinkRowStyle(item.href, true)}
                            >
                              {active && (
                                <span
                                  aria-hidden="true"
                                  style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '0.75rem',
                                    bottom: '0.75rem',
                                    width: '0.0625rem',
                                    background: 'var(--gold)',
                                  }}
                                />
                              )}
                              {item.icon === 'calendar' && (
                                <CalendarDays className="h-4 w-4 shrink-0" style={{ color: active ? 'var(--gold)' : 'var(--gold-dim)' }} aria-hidden="true" />
                              )}
                              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.label}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div
              className="flex items-center gap-1"
              style={{
                minHeight: '3rem',
                padding: '0.375rem 0.75rem 0.5rem',
                borderTop: '0.0625rem solid rgba(200,144,10,0.12)',
                background: '#0f0c09',
                boxShadow: 'inset 0 0.0625rem 0 rgba(255,255,255,0.018)',
                color: 'var(--text-tertiary)',
                position: 'relative',
                zIndex: 70,
                overflow: 'visible',
              }}
            >
              <button
                type="button"
                onClick={openMobileSearch}
                style={mobileUtilityActionStyle}
                aria-label={`${t('common.search' as TranslationKey)} 열기`}
              >
                <Search className="h-4 w-4" style={{ color: 'var(--gold-dim)' }} aria-hidden="true" />
                <span className="max-[360px]:hidden">{t('common.search' as TranslationKey)}</span>
              </button>

              <div data-mobile-language-switcher className="flex min-w-0 flex-1 justify-center" style={{ opacity: 1, position: 'relative', zIndex: 80, overflow: 'visible' }}>
                <LanguageSwitcher />
              </div>

              {user ? (
                <div className="flex min-w-0 shrink-0 items-center gap-1">
                  <Link
                    href="/mypage"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label={t('mypage.title' as TranslationKey)}
                    style={{
                      ...mobileUtilityChipStyle,
                      justifyContent: 'flex-start',
                      maxWidth: '7.75rem',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: '1.375rem',
                        height: '1.375rem',
                        flexShrink: 0,
                        borderRadius: '999rem',
                        overflow: 'hidden',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gold)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        background: 'rgba(200,144,10,0.12)',
                        border: '0.0625rem solid rgba(200,144,10,0.22)',
                      }}
                    >
                      {avatarUrl ? (
                        <Image src={avatarUrl} alt="" fill sizes="1.375rem" style={{ objectFit: 'cover' }} />
                      ) : (
                        accountInitial
                      )}
                    </span>
                    <span className="max-[360px]:hidden" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('mypage.title' as TranslationKey)}
                    </span>
                  </Link>
                  {user.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label="관리자"
                      style={{
                        ...mobileUtilityChipStyle,
                        minWidth: '2.25rem',
                        padding: '0 0.5rem',
                        color: 'var(--text-tertiary)',
                        background: 'transparent',
                      }}
                    >
                      관리
                    </Link>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  style={mobileUtilityChipStyle}
                >
                  {t('common.login' as TranslationKey)}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .nav-search-trigger {
          position: relative;
          overflow: visible;
          box-shadow: none;
        }
        .nav-search-trigger::before {
          content: '';
          position: absolute;
          inset: -0.25rem -0.125rem;
        }
        .nav-search-trigger:hover,
        .nav-search-trigger:focus-visible,
        .nav-search-trigger[data-open="true"] {
          background: rgba(200,144,10,0.1) !important;
          border-color: rgba(232,176,48,0.32) !important;
          color: var(--text-secondary) !important;
        }
        .nav-calendar-shortcut {
          overflow: visible;
        }
        .nav-calendar-shortcut::before {
          content: '';
          position: absolute;
          inset: -0.125rem;
          border-radius: 0.5rem;
        }
        .nav-calendar-shortcut:hover,
        .nav-calendar-shortcut:focus-visible {
          background: rgba(200,144,10,0.06) !important;
          color: var(--gold) !important;
          transform: translateY(-0.0625rem);
        }
        .nav-calendar-shortcut:active {
          transform: scale(0.985);
        }
        @media (prefers-reduced-motion: reduce) {
          .nav-search-trigger,
          .nav-calendar-shortcut {
            transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
          }
          .nav-calendar-shortcut:hover,
          .nav-calendar-shortcut:focus-visible,
          .nav-calendar-shortcut:active {
            transform: none;
          }
        }
      `}</style>

      {/* 전역 검색 모달 */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
