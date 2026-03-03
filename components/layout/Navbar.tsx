'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/sinners',          label: '수감자' },
  { href: '/mirror-dungeon',   label: '거던' },
  { href: '/collection',       label: '보유 현황' },
  { href: '/decks',            label: '덱 게시판' },
  { href: '/meta',             label: '분석' },
]

export default function Navbar() {
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const lastScrollY = useRef(0)
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)
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
  }, [pathname])

  const [avatarError, setAvatarError] = useState(false)
  const user = session?.user
  const avatarUrl = !avatarError ? (user?.image ?? undefined) : undefined
  const displayName = user?.name ?? user?.email ?? ''

  const linkStyle = (href: string) => ({
    fontFamily: 'var(--font-heading)',
    fontSize: '13px',
    color: pathname === href ? 'var(--gold)' : '#7a6845',
    borderBottom: pathname === href ? '1px solid var(--gold)' : 'none',
    paddingBottom: '2px',
  })

  const mobileLinkStyle = (href: string) => ({
    fontFamily: 'var(--font-heading)',
    fontSize: '16px',
    color: pathname === href ? 'var(--gold)' : '#7a6845',
    padding: '14px 0',
    borderBottom: '1px solid rgba(58,42,21,0.3)',
  })

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300"
        style={{
          transform: hidden && !mobileMenuOpen ? 'translateY(-100%)' : 'translateY(0)',
          background: 'linear-gradient(to bottom, rgba(13,11,8,0.97), rgba(13,11,8,0))',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(58,42,21,0.7)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* 로고 — 모바일 축소 */}
          <Link
            href="/"
            className="flex items-center gap-2 font-display tracking-wider transition-colors hover:text-yellow-300 text-[16px] md:text-[19px]"
            style={{ color: 'var(--gold)' }}
          >
            <Image src="/images/logo.webp" alt="" width={25} height={36} unoptimized />
            최애의 관리자
          </Link>

          {/* 데스크탑 네비게이션 */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors duration-200 hover:text-yellow-300"
                style={linkStyle(link.href)}
              >
                {link.label}
              </Link>
            ))}

            {/* 데스크탑 로그인 / 유저 메뉴 */}
            {user ? (
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-2 transition-opacity hover:opacity-80"
                  style={{ cursor: 'pointer' }}
                >
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={30} height={30} unoptimized
                      onError={() => setAvatarError(true)}
                      style={{ borderRadius: '50%', border: '1.5px solid var(--gold-dim)' }} />
                  ) : (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'rgba(200,144,10,0.15)',
                      border: '1.5px solid var(--gold-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--gold)', fontSize: '12px', fontWeight: 'bold',
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
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ color: '#c8a450', fontSize: '12px', fontWeight: 600, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </p>
                      {user.email && (
                        <p style={{ color: '#555566', fontSize: '10px', marginTop: '2px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.email}
                        </p>
                      )}
                    </div>
                    <Link
                      href="/mypage"
                      onClick={() => setMenuOpen(false)}
                      className="block w-full text-left transition-colors hover:bg-white/5"
                      style={{ padding: '10px 14px', color: '#666677', fontSize: '12px' }}
                    >
                      마이 페이지
                    </Link>
                    {user.isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-left transition-colors hover:bg-white/5"
                        style={{ padding: '10px 14px', color: '#666677', fontSize: '12px' }}
                      >
                        관리
                      </Link>
                    )}
                    <button
                      onClick={() => { signOut({ callbackUrl: '/' }); setMenuOpen(false) }}
                      className="w-full text-left transition-colors hover:bg-white/5"
                      style={{ padding: '10px 14px', color: '#666677', fontSize: '12px', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
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
                  fontSize: '12px', color: '#888899',
                  border: '1px solid #333344', borderRadius: '4px',
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
            style={{ color: 'var(--gold)', cursor: 'pointer', padding: '4px' }}
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
          <div className="flex flex-col px-6 py-4">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="block transition-colors duration-200 hover:text-yellow-300"
                style={mobileLinkStyle(link.href)}
              >
                {link.label}
              </Link>
            ))}

            {user ? (
              <>
                {/* 유저 정보 */}
                <div className="flex items-center gap-3 py-4" style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={36} height={36} unoptimized
                      onError={() => setAvatarError(true)}
                      style={{ borderRadius: '50%', border: '1.5px solid var(--gold-dim)' }} />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(200,144,10,0.15)',
                      border: '1.5px solid var(--gold-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--gold)', fontSize: '14px', fontWeight: 'bold',
                    }}>
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p style={{ color: '#c8a450', fontSize: '14px', fontWeight: 600 }}>{displayName}</p>
                    {user.email && (
                      <p style={{ color: '#555566', fontSize: '11px', marginTop: '1px' }}>{user.email}</p>
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
                    fontSize: '16px',
                    color: '#7a6845',
                    padding: '14px 0',
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
                  fontSize: '14px', color: '#888899',
                  border: '1px solid #333344', borderRadius: '6px',
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
    </>
  )
}
