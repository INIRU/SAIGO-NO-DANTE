'use client'

import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/sinners', label: '수감자' },
  { href: '/decks', label: '덱 게시판' },
  { href: '/meta', label: '메타 분석' },
]

export default function Footer() {
  return (
    <footer className="mt-24" style={{ borderTop: '1px solid var(--border)' }}>
      {/* 장식선 */}
      <div className="flex items-center gap-4 px-8 pt-10 max-w-6xl mx-auto">
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, var(--border))' }} />
        <span style={{ color: 'rgba(200,144,10,0.5)', fontSize: '0.75rem', letterSpacing: '0.3em' }}>◆</span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, var(--border))' }} />
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 flex flex-col items-center gap-6">

        {/* 로고 + 사이트명 */}
        <div className="flex flex-col items-center gap-2">
          <Image src="/images/logo.webp" alt="" width={22} height={32}
            style={{ opacity: 0.85, filter: 'drop-shadow(0 0 6px rgba(200,144,10,0.4))' }} />
          <p className="font-serif tracking-widest" style={{ color: 'var(--gold)', fontSize: '0.9375rem' }}>
            최애의 관리자
          </p>
        </div>

        {/* 네비게이션 */}
        <nav aria-label="하단 내비게이션" className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-xs tracking-widest transition-colors duration-200"
              style={{ color: '#9a9ab0' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--gold-dim)' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = '#9a9ab0' }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* 구분 점 */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: '3px', height: '3px', borderRadius: '50%',
              background: i === 1 ? 'rgba(200,144,10,0.4)' : 'rgba(200,144,10,0.15)',
              display: 'inline-block',
            }} />
          ))}
        </div>

        {/* 약관 링크 */}
        <div className="flex items-center gap-4">
          <Link href="/terms"
            className="transition-colors hover:text-yellow-300"
            style={{ color: '#8a8a9a', fontSize: '0.6875rem' }}>
            이용약관
          </Link>
          <span style={{ color: '#6a6a78' }}>·</span>
          <Link href="/privacy"
            className="transition-colors hover:text-yellow-300"
            style={{ color: '#8a8a9a', fontSize: '0.6875rem' }}>
            개인정보 처리방침
          </Link>
        </div>

        {/* 디스클레이머 */}
        <div className="text-center space-y-1">
          <p style={{ color: '#8a8a9a', fontSize: '0.6875rem', letterSpacing: '0.05em' }}>
            팬 제작 비공식 사이트 · Limbus Company는 Project Moon의 저작물입니다.
          </p>
          <p style={{ color: '#6a6a78', fontSize: '0.75rem' }}>
            This is a fan site and is not affiliated with Project Moon.
          </p>
        </div>

      </div>
    </footer>
  )
}
