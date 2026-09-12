import { findAvailableFusions, parseFinalGiftIds } from "./fusion";
import type { FloorEntry, GiftData, RecipeData } from "./types";
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
  return findAvailableFusions(acquired, recipes, gifts).filter(
    (r) =>
      r.canCraft &&
      r.result &&
      finals.has(r.result.game_id) &&
      !acquired.includes(String(r.result.game_id)) &&
      r.pseudoIngredients.length === 0,
  );
}
