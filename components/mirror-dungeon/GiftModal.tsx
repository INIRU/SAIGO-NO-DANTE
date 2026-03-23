'use client'

import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { X, FlaskConical } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { KEYWORD_COLORS, GRADE_LABELS } from './types'
import type { EgoGift, Recipe, EgoGiftTheme } from './types'
import EffectBlock from './EffectBlock'
import MetaItem from './MetaItem'

export default function GiftModal({
  gift,
  recipe,
  giftImageMap,
  onClose,
  getGiftKeywordIcon,
  themes = [],
  onThemeClick,
}: {
  gift: EgoGift
  recipe: Recipe | null
  giftImageMap: Map<string, string>
  onClose: () => void
  getGiftKeywordIcon: (keyword: string) => string | null
  themes?: EgoGiftTheme[]
  onThemeClick?: (id: number) => void
}) {
  const kwColor = KEYWORD_COLORS[gift.keyword] ?? '#666'
  const gradeLabel = GRADE_LABELS[gift.grade] ?? gift.grade
  const isEX = gift.grade === 'EX'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl"
        style={{
          background: '#131110',
          border: `1px solid ${kwColor}30`,
          boxShadow: `0 0 3rem ${kwColor}10, 0 1.5rem 4rem rgba(0,0,0,0.6)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-colors hover:bg-white/10"
          style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
        >
          <X size={18} />
        </button>

        {/* 배너 헤더 */}
        <div className="relative overflow-hidden" style={{ height: '7.5rem', background: `linear-gradient(135deg, ${kwColor}15 0%, transparent 60%)` }}>
          <div className="absolute -right-4 -top-4 opacity-[0.06]" style={{ width: '10rem', height: '10rem' }}>
            {(() => {
              const iconUrl = getGiftKeywordIcon(gift.keyword)
              return iconUrl ? <Image src={iconUrl} alt="" fill sizes="160px" className="object-contain" /> : null
            })()}
          </div>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #131110 0%, transparent 100%)' }} />

          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 px-5 pb-3">
            <div
              className="relative flex-shrink-0 overflow-hidden"
              style={{
                width: '5rem',
                height: '5rem',
                backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                clipPath: 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)',
              }}
            >
              <span
                className="absolute top-[4%] left-[5%] z-10 pointer-events-none"
                style={{
                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  lineHeight: 1,
                  color: isEX ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
                  textShadow: isEX
                    ? '0 0 10px rgb(251,255,8), 0 0 4px rgb(12,90,0), 1px 1px 2px rgba(0,0,0,0.8)'
                    : '0 0 6px rgb(255,114,21), 0 0 2px rgba(0,0,0,0.6)',
                }}
              >
                {gradeLabel}
              </span>
              <div className="absolute bottom-0 right-0 z-10 w-[30%] h-[30%] pointer-events-none">
                {(() => {
                  const iconUrl = getGiftKeywordIcon(gift.keyword)
                  return iconUrl ? <Image src={iconUrl} alt={gift.keyword} fill sizes="24px" className="object-contain" /> : null
                })()}
              </div>
              <div className="absolute inset-[10%] flex items-center justify-center">
                {gift.image_url ? (
                  <div className="relative w-full h-full">
                    <ImageWithFallback src={gift.image_url} alt={gift.name} fill fallbackType="gift" className="object-contain" sizes="70px" />
                  </div>
                ) : (
                  <FlaskConical size="1.5rem" style={{ color: '#444' }} />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 pb-0.5">
              <h2 className="font-serif text-lg md:text-xl font-bold leading-tight" style={{ color: '#e8d8c0', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {gift.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold"
                  style={{ background: `${kwColor}25`, color: kwColor, fontFamily: 'var(--font-heading)' }}
                >
                  {(() => {
                    const iconUrl = getGiftKeywordIcon(gift.keyword)
                    return iconUrl ? <Image src={iconUrl} alt="" width={12} height={12} /> : null
                  })()}
                  {gift.keyword}
                </span>
              {(() => {
                const diff = gift.difficulty || '노말'
                if (diff === '노말') return null
                const isHard = diff === '하드'
                return (
                  <span
                    className="px-2 py-0.5 rounded-full text-[0.625rem] font-bold"
                    style={{
                      background: isHard ? 'rgba(232,144,48,0.15)' : 'rgba(224,64,64,0.15)',
                      color: isHard ? '#e89030' : '#e04040',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {isHard ? 'HARD' : 'EXTREME'}
                  </span>
                )
              })()}
              {gift.enhancement && (
                <span
                  className="px-2 py-0.5 rounded-full text-[0.625rem]"
                  style={{ background: 'rgba(64,160,96,0.15)', color: '#40a060', fontFamily: 'var(--font-heading)' }}
                >
                  강화 가능
                </span>
              )}
              {gift.is_synthesis && (
                <span
                  className="px-2 py-0.5 rounded-full text-[0.625rem]"
                  style={{ background: 'rgba(180,120,220,0.15)', color: '#b478dc', fontFamily: 'var(--font-heading)' }}
                >
                  합성
                </span>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* 효과 */}
        <div className="px-5 pb-4 space-y-3">
          {gift.effect_base && (
            <EffectBlock label="기본" text={gift.effect_base} color="#888" />
          )}
          {gift.effect_plus && (
            <EffectBlock label="+" text={gift.effect_plus} color="#a0a0a0" />
          )}
          {gift.effect_plusplus && (
            <EffectBlock label="++" text={gift.effect_plusplus} color="#e8b030" />
          )}

          {/* 메타 정보 */}
          <div
            className="grid grid-cols-2 gap-2 pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {gift.price != null && (
              <MetaItem label="가격" value={`${gift.price}`} icon="https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/ui/credits.webp" />
            )}
            {gift.sell_price != null && (
              <MetaItem label="판매가" value={`${gift.sell_price}`} icon="https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/icons/ui/credits.webp" />
            )}
            {gift.buy_disabled && (
              <MetaItem label="구매" value="불가" valueColor="#c83030" />
            )}
            {gift.activation_condition != null && (() => {
              const c = gift.activation_condition
              let label = '발동 조건'
              let value = `${c.count}인`
              if (c.type === 'keyword') {
                label = `${c.keyword} 인격`; value = `${c.count}인 이상`
              } else if (c.type === 'multi_keyword') {
                label = `${c.keywords!.join('+')} 인격`; value = `${c.count}인 이상`
              } else if (c.type === 'affiliation') {
                label = `${c.affiliation ?? c.affiliations!.join('/')} 소속`; value = `${c.count}인 이상`
              } else if (c.type === 'skill') {
                label = c.skill_condition!; value = `${c.count}인 이상`
              }
              return <MetaItem label={label} value={value} valueColor="#6090d0" />
            })()}
            {gift.first_appearance && (
              <MetaItem label="첫 등장" value={gift.first_appearance} />
            )}
            {gift.related && gift.related !== '불명' && gift.related !== '-' && (
              <MetaItem label="관련" value={gift.related} />
            )}
          </div>

          {/* 획득 방법 */}
          {gift.acquisition && (
            <div
              className="pt-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p
                className="font-bold mb-1"
                style={{ color: '#666', fontFamily: 'var(--font-heading)', fontSize: '0.625rem' }}
              >
                획득 방법
              </p>
              <p style={{ color: '#a09880', fontSize: '0.75rem', lineHeight: 1.6 }}>
                {gift.acquisition}
              </p>
            </div>
          )}

          {/* 소속 테마팩 */}
          {themes.length > 0 && (
            <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="font-bold mb-1.5" style={{ color: '#666', fontFamily: 'var(--font-heading)', fontSize: '0.625rem' }}>
                소속 테마팩
              </p>
              <div className="flex flex-wrap gap-1.5">
                {themes.map(t => {
                  const isExclusive = gift.game_id ? t.specific_ego_gift_ids.includes(gift.game_id) : false
                  const diff = t.difficulty
                  const diffColor = diff === 'extreme' ? '#e04040' : diff === 'hard' ? '#e89030' : diff === 'effective' ? '#6090d0' : '#888'
                  const diffLabel = diff === 'extreme' ? 'EX' : diff === 'hard' ? 'H' : diff === 'effective' ? 'E' : ''
                  return (
                    <button
                      key={t.id}
                      onClick={() => onThemeClick?.(t.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-white/10"
                      style={{
                        cursor: 'pointer',
                        background: isExclusive ? 'rgba(200,144,10,0.12)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isExclusive ? 'rgba(200,144,10,0.25)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {isExclusive && <span style={{ color: 'var(--gold)', fontSize: '0.5625rem' }}>★</span>}
                      {t.image_url && <ImageWithFallback src={t.image_url} alt="" width={14} height={25} fallbackType="theme" style={{ width: '0.55rem', height: '1rem', objectFit: 'cover', borderRadius: '1px' }} />}
                      <span style={{ color: '#bbb', fontSize: '0.6875rem' }}>{t.name}</span>
                      {diffLabel && <span style={{ color: diffColor, fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                        {diffLabel}
                      </span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 레시피 */}
          {recipe && (
            <div
              className="pt-3 mt-1"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p
                className="text-[0.6875rem] font-bold mb-2 flex items-center gap-1.5"
                style={{ color: '#b478dc', fontFamily: 'var(--font-heading)' }}
              >
                <FlaskConical size={13} />
                조합 레시피
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recipe.ingredients.map((ing, i) => (
                  <span key={i} className="flex items-center">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem]"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: '#bbb',
                      }}
                    >
                      {giftImageMap.get(ing) && (
                        <Image src={giftImageMap.get(ing)!} alt="" width={16} height={16} className="flex-shrink-0" />
                      )}
                      {ing}
                    </span>
                    {i < recipe.ingredients.length - 1 && (
                      <span style={{ color: '#444', margin: '0 2px', fontFamily: 'sans-serif' }}>+</span>
                    )}
                  </span>
                ))}
                <span style={{ color: '#555', margin: '0 4px', fontFamily: 'sans-serif' }}>=</span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.6875rem] font-bold"
                  style={{
                    background: `${kwColor}15`,
                    color: kwColor,
                  }}
                >
                  {giftImageMap.get(recipe.result_name) && (
                    <Image src={giftImageMap.get(recipe.result_name)!} alt="" width={16} height={16} className="flex-shrink-0" />
                  )}
                  {recipe.result_name}
                </span>
              </div>
              {recipe.final_result && (
                <p className="mt-2 text-[0.6875rem]" style={{ color: '#888' }}>
                  <span style={{ color: '#666' }}>최종 합성:</span>{' '}
                  <span style={{ color: '#e8b030' }}>{recipe.final_result}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
