/**
 * Multi-term search parser for deck/planner search
 * + separates OR terms, * separates AND terms
 */

export type ParsedSearch = {
  terms: string[]
  mode: 'or' | 'and' | 'single'
}

export function parseSearchQuery(raw: string): ParsedSearch {
  const trimmed = raw.trim()
  if (!trimmed) return { terms: [], mode: 'single' }

  // * takes precedence (AND)
  if (trimmed.includes('*')) {
    return {
      terms: trimmed.split('*').map(t => t.trim()).filter(Boolean),
      mode: 'and',
    }
  }

  if (trimmed.includes('+')) {
    return {
      terms: trimmed.split('+').map(t => t.trim()).filter(Boolean),
      mode: 'or',
    }
  }

  return { terms: [trimmed], mode: 'single' }
}

/**
 * Get the active term being typed (after last + or *)
 * and the prefix to preserve when selecting from autocomplete
 */
export function getActiveTerm(input: string): { prefix: string; activeTerm: string } {
  const lastPlus = input.lastIndexOf('+')
  const lastStar = input.lastIndexOf('*')
  const lastOp = Math.max(lastPlus, lastStar)

  if (lastOp === -1) {
    return { prefix: '', activeTerm: input.trim() }
  }

  return {
    prefix: input.substring(0, lastOp + 1) + ' ',
    activeTerm: input.substring(lastOp + 1).trim(),
  }
}

/** Check if a single term matches any of the given texts */
export function termMatchesAny(term: string, texts: string[]): boolean {
  const q = term.toLowerCase()
  return texts.some(t => t.toLowerCase().includes(q))
}
