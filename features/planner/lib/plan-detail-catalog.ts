import { resolvePlannerEgo, resolvePlannerIdentity } from '@/lib/planner/catalog-references'

type Gift = { game_id: number; id: string; name: string }
type Recipe = { result_name: string; ingredients: string[] }
type Theme = { id: string | number; fixed_reward_gift_ids?: number[] | null; specific_ego_gift_ids?: number[] | null }
type Identity = { id: string; sinner_id: string; game_id?: string | number | null }
type Ego = { id: string; sinner_id: string; grade: string; name_kr: string | null }

interface Input<G extends Gift, R extends Recipe, T extends Theme, I extends Identity, E extends Ego> {
  plan: { description?: string | null; deck?: unknown; egos?: unknown; gift_inventory?: unknown; floor_plan?: unknown }
  gifts: G[]
  recipes: R[]
  themes: T[]
  identities: I[]
  egos: E[]
  events: { gift_ids?: number[] | null }[]
  eventChoices: { effects?: unknown; selection_condition?: string | null }[]
}

const list = (value: unknown): any[] => (Array.isArray(value) ? value : [])

/** 플랜 상세 화면이 실제로 쓰는 기프트·레시피·인격·에고만 남긴다(전체 카탈로그를 클라이언트로 보내지 않기 위해). */
export function trimPlanDetailCatalog<G extends Gift, R extends Recipe, T extends Theme, I extends Identity, E extends Ego>(input: Input<G, R, T, I, E>) {
  const { plan, gifts, recipes, themes, identities, egos } = input
  const ids = new Set<number>()
  const add = (value: unknown) => { const n = parseInt(String(value), 10); if (Number.isInteger(n)) ids.add(n) }

  const themeById = new Map(themes.map(theme => [String(theme.id), theme]))
  for (const entry of list(plan.floor_plan)) {
    list(entry?.gift_ids).forEach(add)
    const theme = entry?.theme_id != null ? themeById.get(String(entry.theme_id)) : undefined
    ;[...(theme?.fixed_reward_gift_ids ?? []), ...(theme?.specific_ego_gift_ids ?? [])].forEach(add)
  }
  // 'start_12', 'final_12_plus' 같은 인벤토리 키에서 번호만 읽는다
  for (const key of list(plan.gift_inventory)) add(String(key).replace(/^[a-z]+_/, ''))
  for (const event of input.events) list(event.gift_ids).forEach(add)
  for (const choice of input.eventChoices) {
    for (const effect of list(choice.effects)) if (effect?.gift_id) add(effect.gift_id)
    for (const match of choice.selection_condition?.match(/\d+/g) ?? []) add(match)
  }
  const description = plan.description ?? ''
  if (description) for (const gift of gifts) if (description.includes(gift.id) || description.includes(gift.name)) ids.add(gift.game_id)

  // 쓰는 기프트가 결과나 재료인 레시피는 남기고, 그 재료·결과(와 중첩 레시피 재료)의 기프트도 같이 남긴다
  const idByName = new Map(gifts.map(gift => [gift.name, gift.game_id]))
  const keptRecipes = new Set<R>()
  const seeds = new Set(ids)
  for (const recipe of recipes) if ([recipe.result_name, ...recipe.ingredients].some(name => seeds.has(idByName.get(name) ?? -1))) keptRecipes.add(recipe)
  // 남긴 레시피의 재료·결과를 더하고, 재료가 다시 결과인 중첩 레시피도 따라간다(위쪽으로는 번지지 않는다)
  for (const recipe of keptRecipes) {
    for (const name of [recipe.result_name, ...recipe.ingredients]) {
      add(idByName.get(name))
      for (const nested of recipes) if (nested.result_name === name) keptRecipes.add(nested)
    }
  }

  const deckIdentityIds = new Set(list(plan.deck).flatMap(slot => resolvePlannerIdentity(slot, identities)?.id ?? []))
  const egoIds = new Set(list(plan.egos).flatMap(slot => resolvePlannerEgo(slot, egos)?.id ?? []))
  return {
    gifts: gifts.filter(gift => ids.has(gift.game_id)),
    recipes: recipes.filter(recipe => keptRecipes.has(recipe)),
    identities: identities.filter(identity => deckIdentityIds.has(identity.id)),
    egos: egos.filter(ego => egoIds.has(ego.id)),
  }
}

/**
 * Themes for the plan detail, light enough for its payload: a floor theme stays whole (the floor board counts its gift pool);
 * every other theme keeps only the plan's gifts in its pool, all the gift window asks of it (is this gift in that theme). The
 * whole pools of all themes were about 60KB of the page's data.
 */
export function slimPlanThemes<T extends Theme & { ego_gift_ids?: number[] | null }>(themes: T[], { floorThemeIds, giftIds }: { floorThemeIds: ReadonlySet<string>; giftIds: ReadonlySet<number> }): T[] {
  return themes.map(theme => floorThemeIds.has(String(theme.id))
    ? theme
    : { ...theme, ego_gift_ids: (theme.ego_gift_ids ?? []).filter(id => giftIds.has(id)) })
}
