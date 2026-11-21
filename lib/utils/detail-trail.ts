/**
 * The detail windows opened one from another (a gift label, a recipe part, a pack's gift); the last is the one shown.
 * Opening a window already on the way goes back to it, so two gifts that name each other never grow the trail.
 */
export function stepInto<T>(trail: readonly T[], next: T, key: (entry: T) => string): T[] {
  const at = trail.findIndex(entry => key(entry) === key(next))
  return at >= 0 ? trail.slice(0, at + 1) : [...trail, next]
}
