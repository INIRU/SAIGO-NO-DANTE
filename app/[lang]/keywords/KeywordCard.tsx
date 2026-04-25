'use client'

import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { SIN_COLORS } from '@/lib/constants/sin'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedKeywordName, getLocalizedKeywordDesc } from '@/lib/i18n/localize'
import { resolveKeywordIconUrl } from '@/components/providers/KeywordProvider'

interface KeywordCardProps {
  keyword: {
    name: string
    description: string | null
    max_stack: number | null
    icon_slug: string | null
    sin_affinity: string | null
    category: string | null
    name_en?: string | null
    name_jp?: string | null
    description_en?: string | null
    description_jp?: string | null
  }
  identityCount: number
  egoCount: number
  giftCount: number
  animationDelay: number
  onClick: () => void
  lang: SupportedLang
}

export default function KeywordCard({
  keyword: kw, identityCount, egoCount, giftCount, animationDelay, onClick, lang,
}: KeywordCardProps) {
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  const sinColor = kw.sin_affinity
    ? ((SIN_COLORS as Record<string, string>)[kw.sin_affinity] || '#c8900a')
    : null
  const iconUrl = resolveKeywordIconUrl(kw.name, kw.icon_slug)

  const displayName = getLocalizedKeywordName(kw.name, {
    nameEn: kw.name_en,
    nameJp: kw.name_jp,
    descEn: null,
    descJp: null,
  }, lang)

  const displayDesc = getLocalizedKeywordDesc(kw.description ?? '', {
    nameEn: null,
    nameJp: null,
    descEn: kw.description_en,
    descJp: kw.description_jp,
  }, lang)

  const sinLabel = kw.sin_affinity
    ? (translations[('sin.' + kw.sin_affinity) as keyof typeof translations]?.[lang] ?? kw.sin_affinity)
    : null

  return (
    <button
      onClick={onClick}
      className="kw-card group text-left rounded-lg transition-all duration-200 hover:scale-[1.02] w-full h-full flex flex-col"
      style={{
        background: '#1a1510',
        border: '0.0625rem solid rgba(200,144,10,0.08)',
        cursor: 'pointer',
        position: 'relative',
        width: '100%',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = sinColor ? `${sinColor}40` : 'rgba(200,144,10,0.25)'
        el.style.boxShadow = `0 0 1.5rem ${sinColor ? `${sinColor}15` : 'rgba(200,144,10,0.08)'}`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(200,144,10,0.08)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* 죄악 색상 좌측 보더 */}
      {sinColor && (
        <div
          className="absolute left-0 top-0 bottom-0 rounded-l-lg"
          style={{ width: '0.125rem', background: `${sinColor}60` }}
        />
      )}

      <div className="p-3 flex items-start gap-2.5 flex-1">
        {/* 아이콘 */}
        <div
          className="shrink-0 flex items-center justify-center rounded"
          style={{
            width: '2.5rem', height: '2.5rem',
            background: sinColor ? `${sinColor}10` : 'rgba(200,144,10,0.06)',
            border: `0.0625rem solid ${sinColor ? `${sinColor}20` : 'rgba(200,144,10,0.1)'}`,
          }}
        >
          {iconUrl ? (
            <Image src={iconUrl} alt={displayName} width={22} height={22}
              style={{ width: '1.375rem', height: 'auto' }} />
          ) : (
            <span style={{ color: '#555', fontSize: '0.75rem' }}>?</span>
          )}
        </div>

        {/* 텍스트 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-[0.8125rem] truncate" style={{ color: '#e8dcc8' }}>
              {displayName}
            </span>
            {kw.max_stack && (
              <span className="text-[0.625rem] shrink-0" style={{ color: '#7a6845' }}>
                ({t('keyword.maxStack')} {kw.max_stack})
              </span>
            )}
          </div>
          {kw.description && (
            <p
              className="text-[0.6875rem] leading-relaxed line-clamp-2"
              style={{ color: '#7a6845' }}
              title={displayDesc}
            >
              {displayDesc}
            </p>
          )}
          {/* 카운트 태그 */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {identityCount > 0 && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(200,144,10,0.08)', color: '#c8900a' }}>
                {t('keyword.related.identities')} {identityCount}
              </span>
            )}
            {egoCount > 0 && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(180,100,100,0.08)', color: '#b06060' }}>
                EGO {egoCount}
              </span>
            )}
            {giftCount > 0 && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(100,180,100,0.08)', color: '#6a9a6a' }}>
                {t('keyword.related.gifts')} {giftCount}
              </span>
            )}
            {sinColor && sinLabel && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: `${sinColor}10`, color: sinColor }}>
                {t('keyword.sinAffinity')}: {sinLabel}
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={14} className="shrink-0 mt-1 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: '#c8900a' }} />
      </div>

      {/* 하단 글로우 */}
      {sinColor && (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none rounded-b-lg"
          style={{
            height: '1.5rem',
            background: `linear-gradient(transparent, ${sinColor}08)`,
          }}
        />
      )}
    </button>
  )
}
