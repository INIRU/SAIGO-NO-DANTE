/** The in-app page stack of a tab after visiting `path`: returning to the previous page pops, anything else pushes (capped). */
export function nextNavStack(stack: readonly string[], path: string): string[] {
  if (stack.at(-1) === path) return [...stack]
  if (stack.at(-2) === path) return stack.slice(0, -1)
  return [...stack, path].slice(-30)
}
