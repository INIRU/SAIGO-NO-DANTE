'use client'

import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import BaseModal from '@/components/ui/BaseModal'
import KeywordChip from '@/components/ui/KeywordChip'
import { useState } from 'react'
import { X, FlaskConical, ChevronDown } from 'lucide-react'
import { useLocale } from 'next-intl'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName, getLocalizedAffiliation } from '@/lib/i18n/localize'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { OCTAGON_CLIP, GIFT_BG_URL } from '@/lib/constants/gift'
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
  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return (entry as Record<string, string>)[lang] ?? (entry as Record<string, string>)['ko'] ?? key
  }
  const copy = ({
    ko: {
      title: '기프트 상세',
      acquisition: '획득 방법',
      recipe: '조합 레시피',
      recipeFragments: '조각 중 택 2종',
      finalSynthesis: '최종 조합',
      condition: '발동 조건',
      conditionUnit: '인',
      conditionOrMore: '인 이상',
      conditionPersonality: ' 인격',
      conditionAffiliation: ' 소속',
    },
    en: {
      title: 'Gift Details',
      acquisition: 'Acquisition',
      recipe: 'Recipe',
      recipeFragments: 'Choose 2 Fragments',
      finalSynthesis: 'Final Synthesis',
      condition: 'Activation Condition',
      conditionUnit: '',
      conditionOrMore: '+',
      conditionPersonality: ' Identity',
      conditionAffiliation: ' Affiliation',
    },
    ja: {
      title: 'ギフト詳細',
      acquisition: '獲得方法',
      recipe: '合成レシピ',
      recipeFragments: '破片から2種選択',
      finalSynthesis: '最終合成',
      condition: '発動条件',
      conditionUnit: '人',
      conditionOrMore: '人以上',
      conditionPersonality: ' 人格',
      conditionAffiliation: ' 所属',
    },
  } as const)[lang] ?? ({
    title: '기프트 상세',
    acquisition: '획득 방법',
    recipe: '조합 레시피',
    recipeFragments: '조각 중 택 2종',
    finalSynthesis: '최종 조합',
    condition: '발동 조건',
    conditionUnit: '인',
    conditionOrMore: '인 이상',
    conditionPersonality: ' 인격',
    conditionAffiliation: ' 소속',
  } as const)

  const kwColor = KEYWORD_COLORS[gift.keyword] ?? '#666'
  const gradeLabel = GRADE_LABELS[gift.grade] ?? gift.grade
  const isEX = gift.grade === 'EX'
  const displayName = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang)
  const getEffect = (kr: string | null, en: string | null | undefined, jp: string | null | undefined): string | null => {
    if (lang === 'en' && en) return en
    if (lang === 'ja' && jp) return jp
    return kr
  }

  const effectBaseText = getEffect(gift.effect_base, gift.effect_base_en, gift.effect_base_jp)
  const effectPlusText = getEffect(gift.effect_plus, gift.effect_plus_en, gift.effect_plus_jp)
  const effectPlusplusText = getEffect(gift.effect_plusplus, gift.effect_plusplus_en, gift.effect_plusplus_jp)

  // Keyword localization map (Korean → localized display name)
  const KEYWORD_EN: Record<string, string> = {
    '화상': 'Burn', '출혈': 'Bleed', '진동': 'Tremor', '파열': 'Rupture',
    '침잠': 'Sinking', '호흡': 'Poise', '충전': 'Charge', '참격': 'Slash',
    '관통': 'Pierce', '타격': 'Blunt', '공통': 'Common',
  }
  const KEYWORD_JP: Record<string, string> = {
    '화상': '火傷', '출혈': '出血', '진동': '振動', '파열': '破裂',
    '침잠': '沈潜', '호흡': '呼吸', '충전': '充電', '참격': '斬撃',
    '관통': '貫通', '타격': '打撃', '공통': '共通',
  }
  const localizedKeyword = lang === 'en'
    ? (KEYWORD_EN[gift.keyword] ?? gift.keyword)
    : lang === 'ja'
    ? (KEYWORD_JP[gift.keyword] ?? gift.keyword)
    : gift.keyword

  const localizeRelated = (text: string): string => {
    if (lang === 'ko') return text
    const affiliationMatch = text.match(/^집단:\s*(.+)$/)
    if (affiliationMatch) {
      const localized = getLocalizedAffiliation(affiliationMatch[1], lang)
      return lang === 'ja' ? `所属: ${localized}` : `Group: ${localized}`
    }
    const charMatch = text.match(/^캐릭터:\s*(.+)$/)
    if (charMatch) {
      return lang === 'ja' ? `キャラクター: ${charMatch[1]}` : `Character: ${charMatch[1]}`
    }
    const abnoMatch = text.match(/^환상체:\s*(.+)$/)
    if (abnoMatch) {
      return lang === 'ja' ? `幻想体: ${abnoMatch[1]}` : `Abnormality: ${abnoMatch[1]}`
    }
    return text
  }

  const exclusiveThemes = gift.game_id
    ? themes.filter(t => t.specific_ego_gift_ids.includes(gift.game_id!))
    : []

  const [themesOpen, setThemesOpen] = useState(false)

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="32rem" title={copy.title}>
      <div
        className="relative w-full max-h-[85vh] overflow-y-auto rounded-xl"
        style={{
          background: '#131110',
          border: `1px solid ${kwColor}30`,
          boxShadow: `0 0 3rem ${kwColor}10, 0 1.5rem 4rem rgba(0,0,0,0.6)`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
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
          <div className="absolute" style={{ inset: '-1px', background: 'linear-gradient(to top, #131110 0%, transparent 100%)' }} />

          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 px-5 pb-3">
            <div
              className="relative flex-shrink-0 overflow-hidden"
              style={{
                width: '5rem',
                height: '5rem',
                backgroundImage: `url(${GIFT_BG_URL})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                clipPath: OCTAGON_CLIP,
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
                  return iconUrl ? <Image src={iconUrl} alt={localizedKeyword} fill sizes="24px" className="object-contain" /> : null
                })()}
              </div>
              <div className="absolute inset-[10%] flex items-center justify-center">
                {gift.image_url ? (
                  <div className="relative w-full h-full">
                    <ImageWithFallback src={gift.image_url} alt={displayName} fill fallbackType="gift" className="object-contain" sizes="70px" />
                  </div>
                ) : (
                  <FlaskConical size="1.5rem" style={{ color: '#444' }} />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 pb-0.5">
              <h2 className="font-serif text-lg md:text-xl font-bold leading-tight" style={{ color: '#e8d8c0', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {displayName}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <KeywordChip keyword={localizedKeyword} />
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
                  {t('mirrorDungeon.gift.enhancement')}
                </span>
              )}
              {gift.is_synthesis && (
                <span
                  className="px-2 py-0.5 rounded-full text-[0.625rem]"
                  style={{ background: 'rgba(180,120,220,0.15)', color: '#b478dc', fontFamily: 'var(--font-heading)' }}
                >
                  {t('mirrorDungeon.gift.synthesis')}
                </span>
              )}
              {exclusiveThemes.length > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[0.625rem] font-bold"
                  style={{
                    background: 'rgba(200,144,10,0.15)',
                    color: '#e0b040',
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.04em',
                    border: '1px solid rgba(200,144,10,0.3)',
                  }}
                >
                  <span style={{ fontSize: '0.5rem' }}>★</span>
                  {exclusiveThemes.length === 1
                    ? `${t('mirrorDungeon.theme.exclusiveBadge')} · ${getLocalizedName({ name_kr: exclusiveThemes[0].name, name_en: exclusiveThemes[0].name_en, name_jp: exclusiveThemes[0].name_jp }, lang)}`
                    : `${t('mirrorDungeon.theme.exclusiveBadge')} ×${exclusiveThemes.length}`}
                </span>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* 효과 */}
        <div className="px-5 pb-4 space-y-3">
          {effectBaseText && (
            <EffectBlock label={t('mirrorDungeon.gift.effect')} text={effectBaseText} color="#888" />
          )}
          {effectPlusText && (
            <EffectBlock label={t('mirrorDungeon.gift.effectPlus')} text={effectPlusText} color="#a0a0a0" />
          )}
          {effectPlusplusText && (
            <EffectBlock label={t('mirrorDungeon.gift.effectPlusPlus')} text={effectPlusplusText} color="#e8b030" />
          )}

          {/* 메타 정보 */}
          <div
            className="grid grid-cols-2 gap-2 pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {gift.price != null && (
              <MetaItem label={t('mirrorDungeon.gift.price')} value={`${gift.price}`} icon={`${STORAGE_BASE}/icons/ui/credits.webp`} />
            )}
            {gift.sell_price != null && (
              <MetaItem label={t('mirrorDungeon.gift.sellPrice')} value={`${gift.sell_price}`} icon={`${STORAGE_BASE}/icons/ui/credits.webp`} />
            )}
            {gift.buy_disabled && (
              <MetaItem label={t('mirrorDungeon.gift.purchase')} value={t('mirrorDungeon.gift.unavailable')} valueColor="#c83030" />
            )}
            {gift.activation_condition != null && (() => {
              const c = gift.activation_condition
              const unitSuffix = copy.conditionUnit
              const orMoreSuffix = copy.conditionOrMore
              const personalitySuffix = copy.conditionPersonality
              const affiliationSuffix = copy.conditionAffiliation
              let label: string = copy.condition
              let value: string = `${c.count}${unitSuffix}`
              if (c.type === 'keyword') {
                label = `${c.keyword}${personalitySuffix}`; value = `${c.count}${orMoreSuffix}`
              } else if (c.type === 'multi_keyword') {
                label = `${c.keywords!.join('+')}${personalitySuffix}`; value = `${c.count}${orMoreSuffix}`
              } else if (c.type === 'affiliation') {
                const affiliations = c.affiliations ?? (c.affiliation ? [c.affiliation] : [])
                label = `${affiliations.map(affiliation => getLocalizedAffiliation(affiliation, lang)).join('/')}${affiliationSuffix}`; value = `${c.count}${orMoreSuffix}`
              } else if (c.type === 'skill') {
                label = c.skill_condition!; value = `${c.count}${orMoreSuffix}`
              }
              return <MetaItem label={label} value={value} valueColor="#6090d0" />
            })()}
            {gift.related && gift.related !== '불명' && gift.related !== '-' && (
              <MetaItem label={t('mirrorDungeon.gift.related')} value={localizeRelated(gift.related)} />
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
                {copy.acquisition}
              </p>
              <p style={{ color: '#a09880', fontSize: '0.75rem', lineHeight: 1.6 }}>
                {gift.acquisition}
              </p>
            </div>
          )}

          {/* 전용 기프트 섹션 */}
          {exclusiveThemes.length > 0 && (
            <div className="pt-2" style={{ borderTop: '1px solid rgba(200,144,10,0.2)' }}>
              <p className="font-bold mb-1.5" style={{ color: '#c8900a', fontFamily: 'var(--font-heading)', fontSize: '0.625rem', letterSpacing: '0.05em' }}>
                {t('mirrorDungeon.theme.exclusiveGifts')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {exclusiveThemes.map(theme => {
                  const diff = theme.difficulty
                  const diffColor = diff === 'extreme' ? '#e04040' : diff === 'hard' ? '#e89030' : diff === 'effective' ? '#6090d0' : '#888'
                  const diffLabel = diff === 'extreme' ? 'EX' : diff === 'hard' ? 'H' : diff === 'effective' ? 'E' : ''
                  const themeDisplayName = getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang)
                  return (
                    <button
                      key={theme.id}
                      onClick={() => onThemeClick?.(theme.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors hover:bg-white/10"
                      style={{
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(200,144,10,0.18), rgba(200,144,10,0.08))',
                        border: '1px solid rgba(200,144,10,0.35)',
                      }}
                    >
                      <span style={{ color: '#e0b040', fontSize: '0.5625rem' }}>★</span>
                      {theme.image_url && (
                        <ImageWithFallback
                          src={theme.image_url}
                          alt=""
                          width={16}
                          height={28}
                          fallbackType="theme"
                          style={{ width: '0.625rem', height: '1.125rem', objectFit: 'cover', borderRadius: '1px' }}
                        />
                      )}
                      <span style={{ color: '#e8d8c0', fontSize: '0.6875rem', fontWeight: 600 }}>{themeDisplayName}</span>
                      {diffLabel && (
                        <span style={{ color: diffColor, fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                          {diffLabel}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 소속 테마팩 */}
          {themes.length > 0 && (
            <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setThemesOpen(prev => !prev)}
                className="flex items-center justify-between w-full"
                style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, marginBottom: themesOpen ? '0.375rem' : 0 }}
              >
                <span className="font-bold" style={{ color: '#666', fontFamily: 'var(--font-heading)', fontSize: '0.625rem' }}>
                  {t('mirrorDungeon.gift.themes')} ({themes.length})
                </span>
                <ChevronDown
                  size={12}
                  style={{
                    color: '#666',
                    transform: themesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    flexShrink: 0,
                  }}
                />
              </button>
              {themesOpen && (
                <div className="flex flex-wrap gap-1.5">
                  {themes.map(theme => {
                    const isExclusive = gift.game_id ? theme.specific_ego_gift_ids.includes(gift.game_id) : false
                    const diff = theme.difficulty
                    const diffColor = diff === 'extreme' ? '#e04040' : diff === 'hard' ? '#e89030' : diff === 'effective' ? '#6090d0' : '#888'
                    const diffLabel = diff === 'extreme' ? 'EX' : diff === 'hard' ? 'H' : diff === 'effective' ? 'E' : ''
                    const themeDisplayName = getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang)
                    return (
                      <button
                        key={theme.id}
                        onClick={() => onThemeClick?.(theme.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-white/10"
                        style={{
                          cursor: 'pointer',
                          background: isExclusive ? 'rgba(200,144,10,0.08)' : 'rgba(255,255,255,0.05)',
                          border: isExclusive ? '1px solid rgba(200,144,10,0.25)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {isExclusive && <span style={{ color: '#e0b040', fontSize: '0.5rem' }}>★</span>}
                        {theme.image_url && <ImageWithFallback src={theme.image_url} alt="" width={14} height={25} fallbackType="theme" style={{ width: '0.55rem', height: '1rem', objectFit: 'cover', borderRadius: '1px' }} />}
                        <span style={{ color: isExclusive ? '#e8d0a0' : '#bbb', fontSize: '0.6875rem' }}>{themeDisplayName}</span>
                        {diffLabel && <span style={{ color: diffColor, fontSize: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                          {diffLabel}
                        </span>}
                      </button>
                    )
                  })}
                </div>
              )}
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
                {copy.recipe}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {recipe.ingredients.map((ing, i) => (
                  <span key={i} className="flex items-center">
                    {ing === '조각 중 택 2종' ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[0.625rem]"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          color: '#999',
                          fontStyle: 'italic',
                        }}
                      >
                        {copy.recipeFragments}
                      </span>
                    ) : (
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
                    )}
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
                  <span style={{ color: '#666' }}>{copy.finalSynthesis}:</span>{' '}
                  <span style={{ color: '#e8b030' }}>{recipe.final_result}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  )
}
