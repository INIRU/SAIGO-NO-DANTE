'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Menu, X, ChevronDown, Search } from 'lucide-react'
import SearchModal from '@/components/ui/SearchModal'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

type NavGroup = {
  label: string
  items: { href: string; label: string }[]
}

const navGroups: NavGroup[] = [
  {
    label: 'DB',
    items: [
      { href: '/sinners',        label: '수감자' },
      { href: '/mirror-dungeon', label: '거던' },
      { href: '/keywords',       label: '키워드' },
    ],
  },
  {
    label: '커뮤니티',
    items: [
      { href: '/decks',       label: '덱 게시판' },
      { href: '/tier-list',   label: '티어표' },
      { href: '/collection',  label: '보유 현황' },
    ],
  },
  {
    label: '기타',
    items: [
      { href: '/meta',       label: '분석' },
      { href: '/extraction', label: '추출' },
      { href: '/random',     label: '랜덤 편성' },
    ],
  },
]


export default function Navbar() {
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpenGroups, setMobileOpenGroups] = useState<Set<string>>(new Set())
  const [isMac, setIsMac] = useState(false)

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
    const onScroll = () => {
      const current = window.scrollY
      setHidden(current > lastScrollY.current && current > 80)
      lastScrollY.current = current
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const user = session?.user
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

  const mobileLinkStyle = (href: string) => ({
    fontFamily: 'var(--font-heading)',
    fontSize: '1.0625rem',
    color: pathname === href ? 'var(--gold)' : '#a08a60',
    padding: '0.875rem 0',
    borderBottom: '1px solid rgba(58,42,21,0.3)',
  })

  return (
    <>
      <nav
        aria-label="메인 내비게이션"
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
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)' }}
          >
            <Image src="/images/logo.webp" alt="" width={42} height={42} className="w-[34px] md:w-[42px] h-auto -ml-2" />
            최애의 관리자
          </Link>

          {/* 데스크탑 네비게이션 — 드롭다운 그룹 */}
          <div className="hidden md:flex items-center gap-5">
            {navGroups.map(group => {
              const isActive = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
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
                    className="flex items-center gap-1 transition-colors duration-200 hover:text-yellow-300"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.875rem',
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
                        const active = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            className="block transition-all duration-150"
                            style={{
                              padding: '0.625rem 1.25rem',
                              fontFamily: 'var(--font-heading)',
                              fontSize: 'var(--text-sm)',
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
                            {item.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* 검색 버튼 */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="검색 열기 (Ctrl+K)"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200"
              style={{
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                border: '1px solid rgba(200,144,10,0.12)',
                background: 'rgba(200,144,10,0.04)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(200,144,10,0.08)'
                e.currentTarget.style.borderColor = 'rgba(200,144,10,0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(200,144,10,0.04)'
                e.currentTarget.style.borderColor = 'rgba(200,144,10,0.12)'
              }}
              title="검색 (Ctrl+K)"
            >
              <Search size={13} style={{ opacity: 0.7 }} />
              <span style={{ fontSize: '0.75rem', color: '#5a4838', fontFamily: 'var(--font-heading)' }}>검색</span>
              <div className="flex items-center gap-0.5" style={{ marginLeft: '0.25rem' }}>
                <kbd style={{
                  padding: '0.125rem 0.3125rem',
                  fontSize: '0.6875rem',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#6a5838',
                  background: 'linear-gradient(180deg, rgba(200,144,10,0.1) 0%, rgba(200,144,10,0.05) 100%)',
                  border: '1px solid rgba(200,144,10,0.15)',
                  borderRadius: 4,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
                  lineHeight: '1.3',
                  fontWeight: 500,
                }}>
                  {isMac ? '⌘' : 'Ctrl'}
                </kbd>
                <kbd style={{
                  padding: '0.125rem 0.3125rem',
                  fontSize: '0.6875rem',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#6a5838',
                  background: 'linear-gradient(180deg, rgba(200,144,10,0.1) 0%, rgba(200,144,10,0.05) 100%)',
                  border: '1px solid rgba(200,144,10,0.15)',
                  borderRadius: 4,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
                  lineHeight: '1.3',
                  fontWeight: 500,
                }}>
                  K
                </kbd>
              </div>
            </button>

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
                    <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '1.5px solid var(--gold-dim)' }}>
                      <Image src={avatarUrl} alt="" fill sizes="30px" style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
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
                      마이 페이지
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
                      로그아웃
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
                로그인
              </Link>
            )}
          </div>

          {/* 모바일 햄버거 버튼 */}
          <button
            className="md:hidden flex items-center justify-center"
            onClick={() => setMobileMenuOpen(v => !v)}
            style={{ color: 'var(--gold)', cursor: 'pointer', padding: '0.25rem' }}
            aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* 모바일 풀스크린 메뉴 */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden flex flex-col"
          style={{
            top: '64px',
            background: 'rgba(13,11,8,0.98)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex flex-col px-6 py-4" style={{ overflowY: 'auto', flex: 1 }}>
            {navGroups.map(group => {
              const isOpen = mobileOpenGroups.has(group.label)
              return (
                <div key={group.label}>
                  <button
                    onClick={() => setMobileOpenGroups(prev => {
                      const next = new Set(prev)
                      if (next.has(group.label)) next.delete(group.label)
                      else next.add(group.label)
                      return next
                    })}
                    aria-expanded={isOpen}
                    className="flex items-center justify-between w-full"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.8125rem',
                      color: isOpen ? '#8a7855' : '#5a4838',
                      letterSpacing: '0.08em',
                      padding: '0.875rem 0 0.5rem',
                      cursor: 'pointer',
                    }}
                  >
                    {group.label}
                    <ChevronDown size={12} style={{
                      opacity: 0.5,
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                    }} />
                  </button>
                  {isOpen && group.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block transition-colors duration-200 hover:text-yellow-300"
                      style={mobileLinkStyle(item.href)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )
            })}

            {user ? (
              <>
                {/* 유저 정보 */}
                <div className="flex items-center gap-3 py-4" style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
                  {avatarUrl ? (
                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '1.5px solid var(--gold-dim)' }}>
                      <Image src={avatarUrl} alt="" fill sizes="36px" style={{ objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(200,144,10,0.15)',
                      border: '1.5px solid var(--gold-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--gold)', fontSize: '0.9375rem', fontWeight: 'bold',
                    }}>
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p style={{ color: '#c8a450', fontSize: '0.9375rem', fontWeight: 600 }}>{displayName}</p>
                    {user.email && (
                      <p style={{ color: '#999', fontSize: '0.75rem', marginTop: '0.0625rem' }}>{user.email}</p>
                    )}
                  </div>
                </div>

                <Link
                  href="/mypage"
                  className="block transition-colors duration-200 hover:text-yellow-300"
                  style={mobileLinkStyle('/mypage')}
                >
                  마이 페이지
                </Link>
                {user.isAdmin && (
                  <Link
                    href="/admin"
                    className="block transition-colors duration-200 hover:text-yellow-300"
                    style={mobileLinkStyle('/admin')}
                  >
                    관리
                  </Link>
                )}
                <button
                  onClick={() => { signOut({ callbackUrl: '/' }); setMobileMenuOpen(false) }}
                  className="text-left transition-colors duration-200 hover:text-yellow-300"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.0625rem',
                    color: '#a08a60',
                    padding: '0.875rem 0',
                    cursor: 'pointer',
                  }}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 mt-4 justify-center py-3 transition-all duration-200 hover:opacity-80"
                style={{
                  fontSize: '0.9375rem', color: '#888899',
                  border: '1px solid #555570', borderRadius: '6px',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                로그인
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 전역 검색 모달 */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
