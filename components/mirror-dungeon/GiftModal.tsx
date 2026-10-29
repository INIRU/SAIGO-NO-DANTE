'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { giftConditionScope } from '@/lib/planner/gift-condition-status'
import GiftDetailModal, { localizedGiftText, useGiftConditionText, type GiftDetailData, type GiftDetailRecipePart } from '@/components/ui/GiftDetailModal'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { EgoGift, Recipe, EgoGiftTheme } from './types'

const RECIPE_FRAGMENTS = '조각 중 택 2종'

export default function GiftModal({
  gift,
  recipe,
  giftImageMap,
  giftNameMap,
  onClose,
  themes = [],
  onThemeClick,
  gifts,
  onSelectGift,
}: {
  gift: EgoGift
  recipe: Recipe | null
  giftImageMap: Map<string, string>
  giftNameMap: Map<string, string>
  onClose: () => void
  getGiftKeywordIcon?: (keyword: string) => string | null
  themes?: EgoGiftTheme[]
  onThemeClick?: (id: number) => void
  /** Full catalog, so recipe ingredients can open their own detail. */
  gifts?: EgoGift[]
  onSelectGift?: (gift: EgoGift) => void
}) {
  const lang = useLocale() as SupportedLang
  const t = useTranslations('giftDetail')
  const conditionText = useGiftConditionText(lang)
  const giftByName = useMemo(() => new Map((gifts ?? []).map(g => [g.name, g])), [gifts])
  const [previous, setPrevious] = useState<EgoGift | null>(null)

  const name = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang)

  const open = (target: EgoGift) => {
    setPrevious(gift)
    onSelectGift?.(target)
  }
  // Upgrade targets and other gifts named in the effect text open in place, with a back link.
  const giftLinks = useMemo(() => gifts?.length ? {
    selfId: gift.id,
    convertToId: gift.convert_to != null ? gifts.find(g => g.game_id === gift.convert_to)?.id ?? null : null,
    targets: gifts.map(g => ({
      id: g.id,
      name: getLocalizedName({ name_kr: g.name, name_en: g.name_en, name_jp: g.name_jp }, lang),
      image_url: g.image_url,
      gameId: g.game_id,
      onClick: () => { setPrevious(gift); onSelectGift?.(g) },
    })),
  } : null, [gifts, gift, lang, onSelectGift])

  const recipePart = (ingredient: string): GiftDetailRecipePart => {
    if (ingredient === RECIPE_FRAGMENTS) return { text: t('recipeFragments') }
    const found = giftByName.get(ingredient)
    const label = giftNameMap.get(ingredient) ?? ingredient
    if (found) return { gift: { ...found, name: label }, onClick: found.id !== gift.id && onSelectGift ? () => open(found) : undefined }
    return { gift: { name: label, image_url: giftImageMap.get(ingredient) ?? null } }
  }

  const diff = gift.difficulty || '노말'
  const badges: GiftDetailData['badges'] = []
  if (diff === '하드') badges.push({ label: t('hard'), tone: 'orange' })
  if (diff !== '노말' && diff !== '하드') badges.push({ label: t('extreme'), tone: 'red' })
  if (gift.is_synthesis) badges.push({ label: t('synthesis'), tone: 'purple' })

  const giftId = gift.game_id
  const detail: GiftDetailData = {
    name,
    art: { ...gift, name },
    keyword: gift.keyword,
    badges,
    effects: [
      localizedGiftText(lang, gift.effect_base, gift.effect_base_en, gift.effect_base_jp),
      localizedGiftText(lang, gift.effect_plus, gift.effect_plus_en, gift.effect_plus_jp),
      localizedGiftText(lang, gift.effect_plusplus, gift.effect_plusplus_en, gift.effect_plusplus_jp),
    ],
    price: gift.price,
    buyDisabled: gift.buy_disabled,
    condition: conditionText(gift.activation_condition),
    activation: gift.activation_condition,
    conditionScope: giftConditionScope(gift),
    recipe: recipe && {
      ingredients: recipe.ingredients.map(recipePart),
      result: recipePart(recipe.result_name),
    },
    // Packs that give this gift: clear reward first, then pack-exclusive, then the shared pool.
    themes: giftId == null ? [] : themes
      .map(theme => ({
        theme,
        tag: theme.fixed_reward_gift_ids?.includes(giftId) ? 'reward' as const : theme.specific_ego_gift_ids.includes(giftId) ? 'exclusive' as const : undefined,
        inPool: theme.ego_gift_ids.includes(giftId),
      }))
      .filter(entry => entry.tag || entry.inPool)
      .sort((a, b) => (a.tag === 'reward' ? 0 : a.tag ? 1 : 2) - (b.tag === 'reward' ? 0 : b.tag ? 1 : 2))
      .map(({ theme, tag }) => ({ ...theme, tag, onClick: onThemeClick ? () => onThemeClick(theme.id) : undefined })),
    inAllThemes: giftId != null && themes.length > 0 && themes.every(theme => theme.ego_gift_ids.includes(giftId)),
    giftLinks: onSelectGift ? giftLinks : null,
  }

  return (
    <GiftDetailModal
      key={gift.id}
      gift={detail}
      lang={lang}
      onClose={onClose}
      onBack={previous && onSelectGift ? () => { onSelectGift(previous); setPrevious(null) } : undefined}
      backLabel={previous ? t('back', { gift: getLocalizedName({ name_kr: previous.name, name_en: previous.name_en, name_jp: previous.name_jp }, lang) }) : undefined}
    />
  )
}
