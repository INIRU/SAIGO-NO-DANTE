/** A retry edge is not a parent: preserve the first external entry to a child. */
export function registerEventParent(parents: Map<number, number>, parent: number, child: number): void {
  if (parent !== child && !parents.has(child)) parents.set(child, parent)
}
