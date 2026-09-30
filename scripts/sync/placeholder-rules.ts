import {
  hasRawPlaceholder,
  placeholderToken,
  tokenizeGamePlaceholders,
  type PlainPlaceholderToken,
} from '../../lib/game-text/placeholders'

/**
 * What each numbered slot ({0}, {1}, {0:F1}) of the game's text means, decided from the source fields rather than by
 * guessing from the words around it. Every sync that stores game text runs it through one of the functions below, so
 * the DB holds tokens ({{live}}, {{potency}}, {{gift:9228}} …) and never a bare {0}; the site draws the tokens as labels
 * (lib/game-text/placeholders.ts, components/ui/PlaceholderLabel.tsx).
 *
 * A slot without a rule is stored as {{value}} and reported (`⚠ 분류 안 된 자리표시 {5} (KR_Bufs: XxxBuff)`); add it to
 * the tables below instead of letting the sync fail.
 */

/** Collects slots no rule covered, one line per source, printed once at the end of a step. */
export class PlaceholderReport {
  private readonly unknown = new Map<string, Set<string>>()

  add(source: string, slot: string) {
    this.unknown.set(source, (this.unknown.get(source) ?? new Set()).add(slot))
  }

  get size() {
    return this.unknown.size
  }

  lines(): string[] {
    return [...this.unknown].map(([source, slots]) => `⚠ 분류 안 된 자리표시 ${[...slots].join(', ')} (${source}) → {{value}}로 저장`)
  }

  print(log: (line: string) => void = console.warn) {
    for (const line of this.lines()) log(line)
  }
}

const slotLabel = (index: number) => `{${index}}`

// ── Buffs and keywords (KR_Bufs / KR_BattleKeywords, keyed by buff id) ───────────────────────────────────────────

/**
 * Buff slots that are not {0} = potency and {1} = count. Amounts the game accumulates during a battle are live values;
 * some buffs name the unit they are tied to instead of a number.
 */
export const BUFF_PLACEHOLDER_ROLES: Record<string, Record<number, PlainPlaceholderToken>> = {
  Charge: { 2: 'live' }, ChargeBodyArt: { 2: 'live' }, ChargeNoir: { 2: 'live' }, ChargeNoirAlly: { 2: 'live' },
  ChargeKhakiAlly: { 2: 'live' }, ThePowerOfLoveAndHate: { 2: 'live' },
  // Butterfly: "공격자의 정신력을 {2}만큼 회복", "{3}만큼 우울 피해" are computed from the stacks in battle.
  SinkingWhite: { 2: 'live', 3: 'live' }, TimeSuspend: { 2: 'live', 3: 'live' },
  // Prisoner Transport Arrangements: "{0} 포박중" is the enemy being trussed.
  TiedWithRope: { 0: 'target' }, TiedWithRopeID: { 0: 'target' },
  BloomingRose: { 1: 'target', 2: 'target' }, EatingSin: { 1: 'target', 2: 'target' },
}

/**
 * A buff or keyword description: {0} / {0:F1} → {{potency}}, {1} → {{count}}, the exceptions in BUFF_PLACEHOLDER_ROLES,
 * anything else {{value}} (reported with `source`, e.g. "KR_Bufs: Combustion").
 */
export function buffPlaceholders(text: string | null | undefined, buffId: string | null | undefined, report?: PlaceholderReport, source = 'Bufs'): string | null {
  if (text == null) return null
  const roles = (buffId && BUFF_PLACEHOLDER_ROLES[buffId]) || {}
  return tokenizeGamePlaceholders(
    text,
    index => roles[index] ?? (index === 0 ? 'potency' : index === 1 ? 'count' : undefined),
    index => report?.add(`${source}: ${buffId ?? '(id 없음)'}`, slotLabel(index)),
  )
}

// ── E.G.O gifts (ego-gift-*.txt: convertDataList, descType) ──────────────────────────────────────────────────────

export interface GiftPlaceholderSource {
  id: number
  /** convertDataList[0]: the gift this one turns into; its {0} is that gift's name. */
  convertTo?: number | null
  /** descType (ReportUseNumber, ReportBongy …): the game fills the remaining slots with numbers during a run. */
  descType?: string | null
}

/**
 * Gift effect text: with convertDataList the {0} becomes {{gift:<target id>}}, with a descType the remaining slots are
 * live values ({{live}}). A slot neither explains is {{value}} and reported.
 */
export function giftPlaceholders(text: string | null | undefined, gift: GiftPlaceholderSource, report?: PlaceholderReport): string | null {
  if (text == null) return null
  let convertUsed = false
  return tokenizeGamePlaceholders(
    text,
    index => {
      if (index === 0 && gift.convertTo && !convertUsed) {
        convertUsed = true
        return placeholderToken('gift', gift.convertTo) as `{{${string}}}`
      }
      return gift.descType ? 'live' : undefined
    },
    index => report?.add(`EGOgift: ${gift.id}`, slotLabel(index)),
  )
}

// ── Mirror Dungeon event text (KR_AbEvents / KR_ActionEvents) ────────────────────────────────────────────────────

/** Named slots of event narrative (not effect templates such as {reward}, which the event rebuild fills). */
export const EVENT_NAMED_SLOTS: Record<string, PlainPlaceholderToken> = {
  // 1040201 "{affectedTarget} 수감자가 제일 상태가 좋지 않아 보였기에…"
  affectedTarget: 'sinner',
}

/** Event narrative and results: every numbered slot is the sinner the player sent ({{sinner}}). */
export function eventPlaceholders<T extends string | null | undefined>(text: T): T {
  if (!text) return text
  return tokenizeGamePlaceholders(text, () => 'sinner')
    .replace(/\{(\w+)\}/g, (match, name: string) => EVENT_NAMED_SLOTS[name] ? placeholderToken(EVENT_NAMED_SLOTS[name]) : match) as T
}

// ── After an apply: display columns that still hold a bare slot ──────────────────────────────────────────────────

/** Columns the site shows as text, per table; apply-extraction counts the rows among them that still hold {0} or {name}. */
export const PLACEHOLDER_CHECK_COLUMNS: Record<string, readonly string[]> = {
  ego_gifts: ['effect_base', 'effect_base_en', 'effect_base_jp', 'effect_plus', 'effect_plus_en', 'effect_plus_jp',
    'effect_plusplus', 'effect_plusplus_en', 'effect_plusplus_jp'],
  keyword_meta: ['description', 'description_en', 'description_jp'],
  passives: ['description', 'description_en', 'description_jp'],
  md_events: ['desc_text', 'desc_text_en', 'desc_text_jp'],
  md_event_choices: ['result_text', 'result_text_en', 'result_text_jp', 'message', 'message_en', 'message_jp'],
}

/** Rows whose display columns still hold a bare slot, with the offending columns. */
export function rowsWithRawPlaceholders(rows: readonly Record<string, unknown>[], columns: readonly string[]) {
  const found: { row: Record<string, unknown>; columns: string[] }[] = []
  for (const row of rows) {
    const bad = columns.filter(column => typeof row[column] === 'string' && hasRawPlaceholder(row[column] as string))
    if (bad.length) found.push({ row, columns: bad })
  }
  return found
}
