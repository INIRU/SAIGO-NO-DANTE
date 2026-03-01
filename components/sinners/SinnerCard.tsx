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
          border: '1px solid var(--border)',
          borderRadius: '4px',
          overflow: 'hidden',
          transition: 'all 0.25s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--gold-dim)'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(200,144,10,0.25), inset 0 0 20px rgba(200,144,10,0.05)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
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
              unoptimized
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
              className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
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
                  fontSize: '64px',
                  color: 'rgba(200,144,10,0.12)',
                  lineHeight: 1,
                }}
              >
                {sinner.name[0]}
              </span>
            </div>
          )}

          {/* 로고 아이콘 (좌상단) */}
          <div className="absolute top-2 left-2 z-10">
            <Image
              src={getSinnerLogoUrl(sinner.id)}
              alt=""
              width={28}
              height={28}
              unoptimized
              style={{
                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
                opacity: 0.85,
              }}
            />
          </div>

          {/* 순번 이미지 (우상단) */}
          <div className="absolute top-0 right-0 z-[8] pointer-events-none" style={{ width: '45%', opacity: 0.8 }}>
            <Image
              src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`}
              alt={`#${String(sinner.order_num).padStart(2, '0')}`}
              width={389}
              height={1023}
              unoptimized
              className="w-full h-auto"
            />
          </div>

          {/* 하단 그라디언트 오버레이 */}
          <div
            className="absolute bottom-0 left-0 right-0 z-10"
            style={{
              height: '60%',
              background: 'linear-gradient(to top, rgba(13,11,8,1) 0%, rgba(13,11,8,0.85) 40%, rgba(13,11,8,0.3) 75%, transparent 100%)',
            }}
          />

          {/* 이름 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-20">
            <div
              className="font-serif font-bold leading-tight mb-0.5 group-hover:text-yellow-300 transition-colors"
              style={{ color: 'var(--gold-light)', fontSize: '17px' }}
            >
              {sinner.name_kr}
            </div>
            <div
              className="font-title"
              style={{ color: '#7a6845', fontSize: '10px', fontFamily: 'var(--font-title)' }}
            >
              {sinner.name}
            </div>
          </div>
        </div>

        {/* 출처 (카드 하단) */}
        <div
          className="px-3 py-2"
          style={{
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          <p
            className="italic truncate"
            style={{ color: '#4a3820', fontSize: '9px' }}
          >
            {sinner.literary_source}
          </p>
        </div>
      </div>
    </Link>
  )
}
