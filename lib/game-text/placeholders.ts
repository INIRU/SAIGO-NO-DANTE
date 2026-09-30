/**
 * Values the game fills in while playing ({0}, {1}, {0:F1} in the source text) are stored as named tokens such as
 * {{live}} or {{potency}}, and the site draws each token as a label. The sync decides what each number means from the
 * source (buff text, gift descType, event text); the wording and look of the labels live only here and in the UI, so
 * changing them never needs a re-sync. Double braces keep the tokens apart from the game's own {0} and {amount}.
 */

export const PLACEHOLDER_TOKENS = ['live', 'potency', 'count', 'value', 'sinner', 'target'] as const
export type PlaceholderToken = (typeof PLACEHOLDER_TOKENS)[number]

export const placeholderToken = (name: PlaceholderToken) => `{{${name}}}`

/** A token stored in DB text. */
export const TOKEN_PATTERN = /\{\{(live|potency|count|value|sinner|target)\}\}/g
/** A value slot in game text: {0}, {1}, {0:F1}. Named slots such as {amount} are filled by the event rebuild, not here. */
export const GAME_PLACEHOLDER_PATTERN = /\{(\d+)(?::[A-Za-z]\d*)?\}/g

/**
 * Replaces the game's numbered slots with tokens. `role` names what slot N means; a slot it does not know becomes
 * {{value}} and is passed to `onUnknown`, so new source text never reaches the site as a bare {0}.
 */
export function tokenizeGamePlaceholders(
  text: string,
  role: (index: number) => PlaceholderToken | undefined,
  onUnknown?: (index: number) => void,
): string {
  return text.replace(GAME_PLACEHOLDER_PATTERN, (_, index: string) => {
    const name = role(Number(index))
    if (!name) onUnknown?.(Number(index))
    return placeholderToken(name ?? 'value')
  })
}

export type PlaceholderLocale = 'ko' | 'en' | 'ja'

export const PLACEHOLDER_LABELS: Record<PlaceholderLocale, Record<PlaceholderToken, string>> = {
  ko: { live: '게임 중 표시', potency: '수치', count: '횟수', value: '값', sinner: '수감자 이름', target: '대상' },
  en: { live: 'in game', potency: 'Potency', count: 'Count', value: 'Value', sinner: 'Sinner', target: 'Target' },
  ja: { live: 'ゲーム中に表示', potency: '威力', count: '回数', value: '値', sinner: '囚人名', target: '対象' },
}

export function placeholderLabel(name: PlaceholderToken, locale: string): string {
  return (PLACEHOLDER_LABELS[locale as PlaceholderLocale] ?? PLACEHOLDER_LABELS.ko)[name]
}

export type PlaceholderPart = string | { token: PlaceholderToken }

/** Text split into plain runs and tokens, in order. */
export function splitPlaceholders(text: string): PlaceholderPart[] {
  const parts: PlaceholderPart[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ token: match[1] as PlaceholderToken })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** For places that show plain text (search, metadata, previews): each token becomes "(label)". */
export function placeholdersToPlainText<T extends string | null | undefined>(text: T, locale: string): T {
  if (!text) return text
  return text.replace(TOKEN_PATTERN, (_, name: PlaceholderToken) => `(${placeholderLabel(name, locale)})`) as T
}
