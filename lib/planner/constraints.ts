import source from "@/lib/generated/mirror-constraints.json";
export const constraintSource = source;
export function constraintsForFloor(floor: number, owned: Iterable<number>) {
  if (floor < 11 || floor > 15) return [];
  const selected = new Set(owned);
  const rules =
    source.replacementRules.find((r) => r.floorIdx === floor - 1)?.rules ?? [];
  return source.constraints
    .filter((c) => c.flooridx === floor - 1)
    .map((c) => {
      const replacement = rules.find(
        (r) => r.replaceFrom === c.id && !selected.has(r.ifNotOwned),
      );
      return replacement
        ? source.constraints.find((r) => r.id === replacement.replaceTo)!
        : c;
    });
}
export function normalizeConstraints<
  T extends { floor: number; constraints?: number[] },
>(entries: T[]) {
  const owned = new Set<number>();
  return [...entries]
    .sort((a, b) => a.floor - b.floor)
    .map((entry) => {
      const allowed = new Set(
        constraintsForFloor(entry.floor, owned).map((c) => c.id),
      );
      const constraints = [...new Set(entry.constraints ?? [])].filter((id) =>
        allowed.has(id),
      );
      constraints.forEach((id) => owned.add(id));
      return { ...entry, constraints };
    });
}
