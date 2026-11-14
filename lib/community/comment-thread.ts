/** The fields a comment needs to be placed in a thread. */
type ThreadComment = { id: string; parent_id: string | null; created_at: string }
/** One reply in a thread: how deep it sits under the root (1 = answers the root) and the comment it answers. */
type ThreadReply<T> = { comment: T; depth: number; parent: T | null }

function childrenOf<T extends ThreadComment>(comments: T[]) {
  const ids = new Set(comments.map(comment => comment.id))
  const children = new Map<string, T[]>()
  const roots: T[] = []
  for (const comment of comments) {
    // A reply whose parent is not in the list (removed meanwhile) is shown as a comment of its own.
    if (!comment.parent_id || !ids.has(comment.parent_id)) roots.push(comment)
    else children.set(comment.parent_id, [...(children.get(comment.parent_id) ?? []), comment])
  }
  for (const list of children.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return { roots, children }
}

/**
 * Comments grouped by root in the given order, each root's replies in reading order: a reply comes right after the
 * comment it answers (and that comment's earlier replies), siblings oldest first.
 */
export function commentThreads<T extends ThreadComment>(comments: T[]): { root: T; replies: ThreadReply<T>[] }[] {
  const { roots, children } = childrenOf(comments)
  return roots.map(root => {
    const replies: ThreadReply<T>[] = []
    const walk = (parent: T, depth: number) => {
      for (const child of children.get(parent.id) ?? []) {
        replies.push({ comment: child, depth, parent })
        walk(child, depth + 1)
      }
    }
    walk(root, 1)
    return { root, replies }
  })
}

/** Every reply below a comment, at any depth (what deleting it removes). */
export function descendantIds(comments: { id: string; parent_id: string | null }[], id: string): Set<string> {
  const found = new Set<string>()
  let frontier = [id]
  while (frontier.length) {
    const next = comments.filter(comment => comment.parent_id && frontier.includes(comment.parent_id) && !found.has(comment.id)).map(comment => comment.id)
    next.forEach(child => found.add(child))
    frontier = next
  }
  return found
}
