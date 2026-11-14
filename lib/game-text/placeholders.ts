/**
 * Values the game fills in while playing ({0}, {1}, {0:F1} in the source text) are stored as named tokens such as
 * {{live}} or {{potency}}, and the site draws each token as a label. The sync decides what each number means from the
 * source fields (limbus-asset-extractor/site-sync/scripts/sync/placeholder-rules.ts); the wording and look of the labels live only in messages/*.json
 * (`placeholder.*`) and components/ui/PlaceholderLabel.tsx, so changing them never needs a re-sync. Double braces keep
 * the tokens apart from the game's own {0} and {amount}.
 *
 * `{{gift:9228}}` names another gift by game id (a convert_to gift's target); the screen looks its name up.
 */

export const PLACEHOLDER_TOKENS = ['live', 'potency', 'count', 'value', 'sinner', 'target', 'gift'] as const
export type PlaceholderToken = (typeof PLACEHOLDER_TOKENS)[number]
/** A token stored in DB text: {{live}} … or {{gift:<game id>}}. */
const TOKEN_PATTERN = /\{\{(?:(live|potency|count|value|sinner|target)|gift:(\d+))\}\}/g
/** The same token anchored at the start, for scanners that walk text left to right. */
const LEADING_TOKEN_PATTERN = /^\{\{(?:(live|potency|count|value|sinner|target)|gift:(\d+))\}\}/
/** A value slot in game text: {0}, {1}, {0:F1}. Named slots such as {amount} are filled by the event rebuild, not here. */
export const GAME_PLACEHOLDER_PATTERN = /\{(\d+)(?::[A-Za-z]\d*)?\}/g

/**
 * Text a display column must never hold after a sync: a bare game slot ({0}, {1:F1}) or another single-brace
 * name ({amount}). Double-brace tokens are fine.
 */
export function hasRawPlaceholder(text: string | null | undefined): boolean {
  if (!text) return false
  const withoutTokens = text.replace(/\{\{[^{}]*\}\}/g, '')
  return /\{\d/.test(withoutTokens) || /\{\w+\}/.test(withoutTokens)
}

export type PlaceholderLocale = 'ko' | 'en' | 'ja'

/**
 * Labels for places that only show plain text (search subtitles, event titles). The chips read the same wording from
 * messages/*.json `placeholder.*`; tests/lib/game-text/placeholder-render.test.tsx keeps the two equal.
 */
export const PLACEHOLDER_LABELS: Record<PlaceholderLocale, Record<PlaceholderToken, string>> = {
  ko: { live: '게임 중 표시', potency: '수치', count: '횟수', value: '값', sinner: '수감자 이름', target: '대상', gift: '기프트' },
  en: { live: 'Shown in game', potency: 'Potency', count: 'Count', value: 'Value', sinner: 'Sinner', target: 'Target', gift: 'E.G.O Gift' },
  ja: { live: 'ゲーム中に表示', potency: '威力', count: '回数', value: '値', sinner: '囚人名', target: '対象', gift: 'ギフト' },
}

function placeholderLabel(name: PlaceholderToken, locale: string): string {
  return (PLACEHOLDER_LABELS[locale as PlaceholderLocale] ?? PLACEHOLDER_LABELS.ko)[name]
}

export type PlaceholderMatch = { token: PlaceholderToken; giftId?: number }
type PlaceholderPart = string | PlaceholderMatch

function toMatch(plain: string | undefined, giftId: string | undefined): PlaceholderMatch {
  return plain ? { token: plain as PlaceholderToken } : { token: 'gift', giftId: Number(giftId) }
}

/** The token at the start of `text`, with its length, or null. */
export function leadingPlaceholder(text: string): (PlaceholderMatch & { length: number }) | null {
  const match = LEADING_TOKEN_PATTERN.exec(text)
  return match ? { ...toMatch(match[1], match[2]), length: match[0].length } : null
}

/** Text split into plain runs and tokens, in order. */
export function splitPlaceholders(text: string): PlaceholderPart[] {
  const parts: PlaceholderPart[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(toMatch(match[1], match[2]))
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/**
 * For places that show plain text (search, metadata, previews): each token becomes "(label)", a gift token its name
 * when `giftName` knows it.
 */
export function placeholdersToPlainText<T extends string | null | undefined>(
  text: T,
  locale: string,
  giftName?: (gameId: number) => string | null | undefined,
): T {
  if (!text) return text
  return text.replace(TOKEN_PATTERN, (_, plain: string | undefined, giftId: string | undefined) => {
    if (plain) return `(${placeholderLabel(plain as PlaceholderToken, locale)})`
    const name = giftName?.(Number(giftId))
    return name ? `[${name}]` : `(${placeholderLabel('gift', locale)})`
  }) as T
}
