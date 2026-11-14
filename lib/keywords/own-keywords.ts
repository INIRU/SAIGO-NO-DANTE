import type { GameTextRefNames } from '@/lib/game-text/ref-names'
import { collectKeywordIds, mayBeRawGameText, parseGameText } from '@/lib/game-text/rich-text'

/**
 * The keywords an identity or E.G.O owns, as keyword_meta names (Korean): its keyword list (`identities.keywords`,
 * `ego.keywords`) plus every keyword its own skill and passive texts reference as `[Id]` / `<link>`. Plain words of
 * older game text are only searched among these (lib/keywords/plain-keywords.ts). `texts` are all texts of that
 * identity / E.G.O (every skill and passive, all uptie levels), not only the one being drawn; without the reference
 * table (`refs` null) only the list counts.
 */
export function ownKeywordSet(
  listed: readonly string[] | null | undefined,
  texts: readonly (string | null | undefined)[],
  refs: GameTextRefNames | null | undefined,
): ReadonlySet<string> {
  const own = new Set(listed ?? [])
  if (!refs) return own
  for (const text of texts) {
    if (!text || !mayBeRawGameText(text)) continue
    for (const id of collectKeywordIds(parseGameText(text))) {
      const ref = refs[id]
      if (ref?.k === 'keyword' && ref.kw) own.add(ref.kw)
    }
  }
  return own
}

type Described = { description?: string | null; description_en?: string | null; description_jp?: string | null }

/** Every description (all languages that were sent) of the skill or passive rows of one identity. */
export function descriptionTexts(...groups: readonly (readonly Described[] | null | undefined)[]): string[] {
  const out: string[] = []
  for (const rows of groups) for (const row of rows ?? []) for (const text of [row.description, row.description_en, row.description_jp]) if (text) out.push(text)
  return out
}

type EgoTextSource = {
  ego_skills?: readonly object[] | null
  ego_cor_skills?: readonly object[] | null
  stage_passives?: readonly Described[] | null
  passive_content?: string | null
  passive_content_en?: string | null
  passive_content_jp?: string | null
}
const EGO_EFFECTS = ['normalEffect', 'coin1Effect', 'coin2Effect', 'coin3Effect', 'coin4Effect', 'coin5Effect'] as const

/** Every skill effect and passive text of one E.G.O (normal and corroded skills, all stages, all languages that were sent). */
export function egoTexts(ego: EgoTextSource): string[] {
  const out = descriptionTexts(ego.stage_passives)
  for (const text of [ego.passive_content, ego.passive_content_en, ego.passive_content_jp]) if (text) out.push(text)
  for (const skill of [...(ego.ego_skills ?? []), ...(ego.ego_cor_skills ?? [])] as Record<string, unknown>[])
    for (const suffix of ['', '_en', '_jp']) {
      for (const effect of EGO_EFFECTS) {
        const text = skill[effect + suffix]
        if (typeof text === 'string' && text) out.push(text)
      }
      // Coins past the fifth exist only in the full list.
      const coins = skill['coinEffects' + suffix]
      if (Array.isArray(coins)) for (const text of coins.slice(5)) if (typeof text === 'string' && text) out.push(text)
    }
  return out
}
