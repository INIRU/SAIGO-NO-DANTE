import { isRawGameText, parseGameText, type GameTextNode } from '@/lib/game-text/rich-text'

function referencedIds(nodes: readonly GameTextNode[], out: Set<string>) {
  for (const node of nodes) {
    if (node.type === 'ref') out.add(node.id)
    else if (node.type === 'element') {
      if (node.tag === 'link' && node.value) out.add(node.value)
      referencedIds(node.children, out)
    }
  }
}

/**
 * Finds which keywords a gift's effect texts mention. `refKeywords` maps a game id (`[Id]`) to the keyword_meta name it
 * stands for. A text that is game text names its keywords by id (`[Id]` or `<link="Id">`); plain words in it are not
 * guessed at. Older stored text has the keyword names written out, so those are looked up by name.
 */
export function createGiftMentionMatcher(keywordNames: readonly string[], refKeywords: Readonly<Record<string, string>>) {
  const refIds: ReadonlySet<string> = new Set(Object.keys(refKeywords))
  return (effects: readonly (string | null | undefined)[]): Set<string> => {
    const found = new Set<string>()
    for (const effect of effects) {
      if (!effect) continue
      if (isRawGameText(effect, refIds)) {
        const ids = new Set<string>()
        referencedIds(parseGameText(effect), ids)
        for (const id of ids) {
          const name = refKeywords[id]
          if (name) found.add(name)
        }
      } else {
        for (const name of keywordNames) if (effect.includes(name)) found.add(name)
      }
    }
    return found
  }
}
