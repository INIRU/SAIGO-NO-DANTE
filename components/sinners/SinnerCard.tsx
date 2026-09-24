
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { Link } from '@/lib/i18n/navigation'
import Image from 'next/image'
import { Sinner, getSinnerProfileUrl, getSinnerLogoUrl } from '@/lib/data/sinners'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n'
import { getTranslations, getLocale } from 'next-intl/server'

interface SinnerCardProps {
  sinner: Sinner
  index?: number
  priority?: boolean
}

export default async function SinnerCard({ sinner, priority: priorityProp = false }: SinnerCardProps) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()])
  const displayName = getLocalizedName(sinner, locale as SupportedLang)
  const profileUrl = getSinnerProfileUrl(sinner.id)

  return (
    <Link href={`/sinners/${sinner.id}`} className="block rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
      <div
        className="group cursor-pointer overflow-hidden rounded transition-colors duration-200 hover:border-[rgba(200,144,10,0.55)]"
        style={{
          background: '#17120c',
          border: '0.0625rem solid #2e2417',
        }}
      >
        {/* 포트레이트 영역 */}
        <div className="relative overflow-hidden" style={{ aspectRatio: '3/4' }}>
          {/* 캐릭터 이미지 */}
          {profileUrl ? (
            <Image
              src={profileUrl}
              alt={sinner.name}
              fill
              // 16:9 art cropped by object-cover into a 3:4 card renders ~2.4x the card width.
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 72vw, (max-width: 1024px) 55vw, 460px"
              quality={90}
              loading={priorityProp ? 'eager' : 'lazy'}
              fetchPriority={priorityProp ? 'high' : undefined}
              className="object-cover object-top motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-[1.04]"
              style={{ objectPosition: '50% 15%' }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)' }}
            >
              <span
                className="font-serif font-light select-none"
                style={{ fontSize: '4rem', color: 'rgba(200,144,10,0.12)', lineHeight: 1 }}
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
              className="opacity-85 group-hover:opacity-100 transition-opacity duration-300"
              style={{ width: '1.75rem', height: 'auto', filter: 'drop-shadow(0 0.0625rem 0.1875rem rgba(0,0,0,0.8))' }}
            />
          </div>

          {/* 순번 이미지 (우상단) */}
          <div className="absolute top-0 right-0 z-[8] pointer-events-none opacity-80" style={{ width: '45%' }}>
            <Image
              src={getGameUiAsset(`sinners/${sinner.id}`)}
              alt={`#${String(sinner.order_num >= 10 ? sinner.order_num + 1 : sinner.order_num).padStart(2, '0')}`}
              width={389}
              height={1023}
              sizes="96px"
              loading={priorityProp ? 'eager' : 'lazy'}
              fetchPriority={priorityProp ? 'high' : undefined}
              className="w-full h-auto"
            />
          </div>

          {/* 하단 그라디언트 오버레이 */}
          <div
            className="absolute z-10"
            style={{
              bottom: '-1px', left: '-1px', right: '-1px',
              height: 'calc(65% + 1px)',
              background: 'linear-gradient(to top, rgba(13,11,8,1) 0%, rgba(13,11,8,0.9) 35%, rgba(13,11,8,0.3) 70%, transparent 100%)',
            }}
          />

          {/* 이름 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-20">
            <div
              className="leading-tight"
              style={{ color: 'var(--gold-light)', fontSize: '1.125rem', fontFamily: 'var(--font-heading)' }}
            >
              {displayName}
            </div>
            <div
              style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-title)', letterSpacing: '0.02em' }}
            >
              {sinner.name}
            </div>
          </div>
        </div>

        {/* 출처 (카드 하단) */}
        <div className="px-3 py-2" style={{ borderTop: '0.0625rem solid #2e2417' }}>
          <p
            className="line-clamp-2"
            style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', lineHeight: 1.45, minHeight: '2.9em' }}
          >
            {t(`sinner.source.${sinner.id}`)}
          </p>
        </div>
      </div>
    </Link>
  )
}
