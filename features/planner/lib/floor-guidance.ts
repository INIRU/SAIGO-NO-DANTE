import { findAvailableFusions, parseFinalGiftIds } from "@/lib/planner/fusion";
import type { FloorEntry, GiftData, RecipeData } from "@/lib/planner/types";
export function craftableAtFloor(
  floor: number,
  entries: Pick<FloorEntry, "floor" | "gift_ids">[],
  inventory: string[],
  recipes: RecipeData[],
  gifts: Map<number, GiftData>,
) {
  const acquired = entries
    .filter((e) => e.floor <= floor)
    .flatMap((e) => e.gift_ids);
  const finals = parseFinalGiftIds(inventory);
  const previousGifts = entries.filter((entry) => entry.floor < floor).flatMap((entry) => entry.gift_ids);
  const previouslyCraftable = new Set(findAvailableFusions(previousGifts, recipes, gifts)
    .filter((recipe) => recipe.canCraft && recipe.pseudoIngredients.length === 0)
    .map((recipe) => recipe.result?.game_id));
  return findAvailableFusions(acquired, recipes, gifts).filter(
    (r) =>
      r.canCraft &&
      r.result &&
      finals.has(r.result.game_id) &&
      !previouslyCraftable.has(r.result.game_id) &&
      !acquired.includes(String(r.result.game_id)) &&
      r.pseudoIngredients.length === 0,
  );
}
