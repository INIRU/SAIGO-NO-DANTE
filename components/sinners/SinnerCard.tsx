'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Sinner, getSinnerProfileUrl, getSinnerLogoUrl, STORAGE_BASE } from '@/lib/data/sinners'

interface SinnerCardProps {
  sinner: Sinner
  index?: number
}

export default function SinnerCard({ sinner, index = 0 }: SinnerCardProps) {
  const profileUrl = getSinnerProfileUrl(sinner.id)

  return (
    <Link href={`/sinners/${sinner.id}`}>
      <div
        className="group cursor-pointer"
        style={{
          animationDelay: `${index * 60}ms`,
          animationFillMode: 'both',
          background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
          border: '0.0625rem solid var(--border)',
          borderRadius: '0.375rem',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(200,144,10,0.4)'
          e.currentTarget.style.boxShadow = '0 0.5rem 2rem rgba(200,144,10,0.15), 0 0 1.5rem rgba(200,144,10,0.08), inset 0 0 1.25rem rgba(200,144,10,0.04)'
          e.currentTarget.style.transform = 'translateY(-0.125rem)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {/* 포트레이트 영역 */}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: '3/4' }}
        >
          {/* 캐릭터 이미지 */}
          {profileUrl ? (
            <Image
              src={profileUrl}
              alt={sinner.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
              className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-110"
              style={{ objectPosition: '50% 15%' }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)',
              }}
            >
              <span
                className="font-serif font-bold select-none"
                style={{
                  fontSize: '4rem',
                  color: 'rgba(200,144,10,0.12)',
                  lineHeight: 1,
                }}
              >
                {sinner.name[0]}
              </span>
            </div>
          )}

          {/* 호버 시 상단 골드 라인 */}
          <div
            className="absolute top-0 left-0 right-0 z-20 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
            style={{
              height: '0.125rem',
              background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
            }}
          />

          {/* 로고 아이콘 (좌상단) */}
          <div className="absolute top-2 left-2 z-10">
            <Image
              src={getSinnerLogoUrl(sinner.id)}
              alt=""
              width={28}
              height={28}
              style={{
                filter: 'drop-shadow(0 0.0625rem 0.1875rem rgba(0,0,0,0.8))',
                opacity: 0.85,
                transition: 'opacity 0.3s ease',
              }}
              className="group-hover:opacity-100"
            />
          </div>

          {/* 순번 이미지 (우상단) */}
          <div className="absolute top-0 right-0 z-[8] pointer-events-none" style={{ width: '45%', opacity: 0.8 }}>
            <Image
              src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`}
              alt={`#${String(sinner.order_num).padStart(2, '0')}`}
              width={389}
              height={1023}
              className="w-full h-auto"
            />
          </div>

          {/* 하단 그라디언트 오버레이 */}
          <div
            className="absolute bottom-0 left-0 right-0 z-10"
            style={{
              height: '65%',
              background: 'linear-gradient(to top, rgba(13,11,8,1) 0%, rgba(13,11,8,0.9) 35%, rgba(13,11,8,0.3) 70%, transparent 100%)',
            }}
          />

          {/* 이름 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-20">
            <div
              className="font-serif font-bold leading-tight mb-0.5 group-hover:text-yellow-300 transition-colors duration-300"
              style={{ color: 'var(--gold-light)', fontSize: '1.0625rem' }}
            >
              {sinner.name_kr}
            </div>
            <div
              className="font-title transition-colors duration-300"
              style={{ color: '#a08a60', fontSize: '0.75rem', fontFamily: 'var(--font-title)' }}
            >
              {sinner.name}
            </div>
          </div>
        </div>

        {/* 출처 (카드 하단) */}
        <div
          className="px-3 py-2"
          style={{
            borderTop: '0.0625rem solid var(--border)',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.4) 100%)',
          }}
        >
          <p
            className="italic truncate"
            style={{ color: '#7a6840', fontSize: '0.6875rem', letterSpacing: '0.02em' }}
          >
            {sinner.literary_source}
          </p>
        </div>
      </div>
    </Link>
  )
}
