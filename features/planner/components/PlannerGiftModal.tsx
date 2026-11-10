'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { giftConditionScope } from '@/lib/planner/gift-condition-status'
import GiftDetailModal, { localizedGiftText, useGiftConditionText, type GiftDetailRecipePart } from '@/features/mirror-dungeon/components/GiftDetailModal'
import type { GiftData, ThemeData } from '@/lib/planner/types'
import type { GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'

export interface RecipeLookup {
  materials: GiftData[]
  result: GiftData
  pseudoIngredients?: string[]
}

interface Props {
  gift: GiftData
  onClose: () => void
  themes?: ThemeData[]
  onThemeClick?: (themeId: string) => void
  enhance?: number
  conditionStatus?: GiftConditionStatus | null
  recipe?: RecipeLookup | null
  /** All gifts, so a gift the effect text points at ({{gift:<id>}}) shows by name and opens here. */
  gifts?: GiftData[]
}

export default function PlannerGiftModal({ gift, onClose, themes = [], onThemeClick, enhance, conditionStatus, recipe, gifts }: Props) {
  const lang = useLocale() as SupportedLang
  const t = useTranslations('giftDetail')
  const conditionText = useGiftConditionText(lang)
  // A recipe ingredient opens inside this modal; the planned gift's enhance, status and recipe apply only to it.
  const [material, setMaterial] = useState<GiftData | null>(null)
  const shown = material ?? gift
  const localName = (g: GiftData) => getLocalizedName({ name_kr: g.name, name_en: g.name_en, name_jp: g.name_jp }, lang)
  const part = (g: GiftData): GiftDetailRecipePart => ({ gift: { ...g, name: localName(g) }, onClick: g.game_id === gift.game_id ? undefined : () => setMaterial(g) })
  const name = localName(shown)
  const named = new Set([...`${shown.effect_base} ${shown.effect_plus} ${shown.effect_plusplus}`.matchAll(/\{\{gift:(\d+)\}\}/g)].map(m => Number(m[1])))
  const targets = (gifts ?? []).filter(g => named.has(g.game_id)).map(g => ({ id: String(g.game_id), name: localName(g), image_url: g.image_url, keyword: g.keyword, gameId: g.game_id, onClick: () => setMaterial(g) }))

  return (
    <GiftDetailModal
      key={shown.game_id}
      lang={lang}
      onClose={onClose}
      initialLevel={material ? 0 : enhance ?? 0}
      onBack={material ? () => setMaterial(null) : undefined}
      backLabel={t('back', { gift: localName(gift) })}
      gift={{
        name,
        art: { ...shown, name },
        keyword: shown.keyword,
        effects: [
          localizedGiftText(lang, shown.effect_base, shown.effect_base_en, shown.effect_base_jp),
          localizedGiftText(lang, shown.effect_plus, shown.effect_plus_en, shown.effect_plus_jp),
          localizedGiftText(lang, shown.effect_plusplus, shown.effect_plusplus_en, shown.effect_plusplus_jp),
        ],
        condition: conditionText(shown.activation_condition),
        activation: shown.activation_condition,
        conditionScope: giftConditionScope(shown),
        conditionStatus: material ? null : conditionStatus,
        recipe: !material && recipe ? {
          ingredients: [...recipe.materials.map(part), ...(recipe.pseudoIngredients ?? []).map(text => ({ text }))],
          result: part(recipe.result),
        } : null,
        giftLinks: targets.length ? { targets } : null,
        inAllThemes: themes.length > 0 && themes.every(theme => (theme.ego_gift_ids ?? []).includes(shown.game_id)),
        themes: themes
          .map(theme => ({
            theme,
            tag: theme.fixed_reward_gift_ids?.includes(shown.game_id) ? 'reward' as const : theme.specific_ego_gift_ids?.includes(shown.game_id) ? 'exclusive' as const : undefined,
            inPool: (theme.ego_gift_ids ?? []).includes(shown.game_id),
          }))
          .filter(entry => entry.tag || entry.inPool)
          .sort((a, b) => (a.tag === 'reward' ? 0 : a.tag ? 1 : 2) - (b.tag === 'reward' ? 0 : b.tag ? 1 : 2))
          .map(({ theme, tag }) => ({ ...theme, tag, onClick: onThemeClick ? () => onThemeClick(theme.id) : undefined })),
      }}
    />
  )
}
