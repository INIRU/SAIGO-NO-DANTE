'use client'

// Design Ref: §5.5 — EGO 전용 브라우저 카드
import Link from 'next/link'
import Image from 'next/image'
import { STORAGE_BASE, GRADE_COLORS } from '@/lib/constants/game'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { BLUR_PLACEHOLDER } from '@/lib/utils/images'
import type { EGOBrowserItem } from '@/lib/types/browser'

type Props = {
  ego: EGOBrowserItem
}

export default function EGOBrowserCard({ ego }: Props) {
  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const gradeIconUrl = ['ZAYIN', 'TETH', 'HE', 'WAW'].includes(ego.grade)
    ? `${STORAGE_BASE}/icons/grade/${ego.grade}.webp`
    : null
  const href = `/sinners/${ego.sinner_slug}/ego/${ego.id}`
  const imageUrl = ego.image_url
  const sinnerLogo = getSinnerLogoUrl(ego.sinner_id)

  return (
    <Link
      href={href}
      className="block group rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${gradeColor}40`,
        background: '#1a1510',
        position: 'relative',
      }}
      aria-label={`${ego.name_kr || ego.name} 상세 보기`}
    >
      {/* 이미지 영역 */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '3/4' }}>
        {/* 배경 이미지 (호버 시 확대) */}
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={ego.name_kr || ego.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#151210' }}>
            <span style={{ color: '#333', fontSize: '0.75rem' }}>No Image</span>
          </div>
        )}

        {/* 오버레이 요소들 (scale 영향 안 받음) */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 수감자 로고 (좌상단) */}
          <div className="absolute top-1.5 left-1.5">
            <Image
              src={sinnerLogo}
              alt={ego.sinner_name_kr}
              width={24}
              height={24}
              style={{ width: '1.5rem', height: 'auto', objectFit: 'contain' }}
              unoptimized
            />
          </div>

          {/* 등급 배지 (우상단) */}
          <div className="absolute top-1.5 right-1.5">
            {gradeIconUrl ? (
              <Image
                src={gradeIconUrl}
                alt={ego.grade}
                width={36}
                height={14}
                style={{ width: '2.25rem', height: 'auto', objectFit: 'contain' }}
                unoptimized
              />
            ) : (
              <span style={{
                fontSize: '0.5625rem',
                fontWeight: 700,
                color: gradeColor,
                letterSpacing: '0.05em',
              }}>
                {ego.grade}
              </span>
            )}
          </div>

          {/* 하단 그라데이션 + 이름 */}
          <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-8" style={{
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          }}>
            <p className="text-xs font-bold leading-tight truncate" style={{ color: '#eee' }}>
              {ego.name_kr || ego.name}
            </p>
          </div>
        </div>
      </div>

      {/* 호버 시 테두리 강조 */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ border: `2px solid ${gradeColor}` }}
      />
    </Link>
  )
}
