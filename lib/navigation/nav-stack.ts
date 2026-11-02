/** Whether the page before the current one was `href`, its query and language prefix aside. */
export function cameFrom(stack: readonly string[], href: string): boolean {
  return stack.at(-2)?.endsWith(href.split('?')[0]) ?? false
}

/** The in-app page stack of a tab after visiting `path`: returning to the previous page pops, anything else pushes (capped). */
export function nextNavStack(stack: readonly string[], path: string): string[] {
  if (stack.at(-1) === path) return [...stack]
  if (stack.at(-2) === path) return stack.slice(0, -1)
  return [...stack, path].slice(-30)
}
