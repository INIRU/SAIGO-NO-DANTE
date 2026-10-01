import type { GiftData } from '@/lib/planner/types'
import { gameTextToPlain, mayBeRawGameText } from '@/lib/game-text/rich-text'

/**
 * Lower-case text the gift search matches a query against: the gift's names and keyword, and its base effect. Effects of
 * raw game text are read as plain text (`[Id]` as the name `names` gives it, tags dropped); older text as written.
 */
export function giftSearchText(
  gift: Pick<GiftData, 'name' | 'name_en' | 'name_jp' | 'keyword' | 'effect_base'>,
  { names, locale }: { names?: Readonly<Record<string, string>>; locale: string },
): string {
  const effect = gift.effect_base && mayBeRawGameText(gift.effect_base)
    ? gameTextToPlain(gift.effect_base, { names, locale })
    : gift.effect_base
  return [gift.name, gift.name_en, gift.name_jp, gift.keyword, effect].filter(Boolean).join(' ').toLocaleLowerCase()
}
