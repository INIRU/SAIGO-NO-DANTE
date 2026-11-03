import { gameTextPieces, ocrNormalized } from './text-normalize'

export interface OcrWord {
  text: string
  confidence: number
  left: number
  top: number
  width: number
  height: number
}

export interface OcrDocument { text: string; words: OcrWord[] }
export interface OcrReference { id: string; texts: string[]; effectTexts?: string[] }
export interface OcrChoiceReference extends OcrReference { eventId: string; resultTexts?: string[] }
export interface OcrCatalog {
  gifts: OcrReference[]
  events: OcrReference[]
  choices: OcrChoiceReference[]
}
export interface OcrMatch { id: string; score: number }
export interface OcrChoiceMatch extends OcrMatch { eventId: string }
export interface OcrMatches { gifts: OcrMatch[]; events: OcrMatch[]; choices: OcrChoiceMatch[] }

const normalized = ocrNormalized
const contentLength = (value: string) => [...value].length
const EFFECT_FRAGMENT = 7

function effectOffsets(length: number): number[] {
  if (length < EFFECT_FRAGMENT) return []
  const offsets: number[] = []
  for (let offset = 0; offset + EFFECT_FRAGMENT <= length; offset += 2) offsets.push(offset)
  if (offsets.at(-1) !== length - EFFECT_FRAGMENT) offsets.push(length - EFFECT_FRAGMENT)
  return offsets
}

const effectCache = new WeakMap<OcrCatalog, { owners: Map<string, string | null>; texts: Map<string, string[]> }>()

function indexedEffects(catalog: OcrCatalog) {
  const cached = effectCache.get(catalog)
  if (cached) return cached
  const owners = new Map<string, string | null>()
  const texts = new Map<string, string[]>()
  for (const gift of catalog.gifts) {
    const effects = (gift.effectTexts ?? []).flatMap(gameTextPieces)
    texts.set(gift.id, effects)
    for (const effect of effects) {
      const characters = [...effect]
      // Ownership must consider every position; probing may be sparser.
      for (let offset = 0; offset + EFFECT_FRAGMENT <= characters.length; offset++) {
        const fragment = characters.slice(offset, offset + EFFECT_FRAGMENT).join('')
        const owner = owners.get(fragment)
        if (owner === undefined) owners.set(fragment, gift.id)
        else if (owner !== gift.id) owners.set(fragment, null)
      }
    }
  }
  const index = { owners, texts }
  effectCache.set(catalog, index)
  return index
}

function adjacentShortName(name: string, words: OcrWord[]): boolean {
  for (let index = 0; index < words.length - 1; index++) {
    const first = words[index]
    const second = words[index + 1]
    if (first.confidence < 85 || second.confidence < 85 ||
      Math.abs(first.top - second.top) > Math.max(first.height, second.height) / 2 ||
      second.left - (first.left + first.width) > Math.max(first.height, second.height) * 1.5 ||
      second.left < first.left) continue
    if (normalized(first.text + second.text) === name) return true
  }
  return false
}

function uniqueEffectEvidence(giftId: string, screen: string, index: ReturnType<typeof indexedEffects>): boolean {
  for (const effect of index.texts.get(giftId) ?? []) {
    const characters = [...effect]
    const matches: { source: number; screen: number }[] = []
    for (const offset of effectOffsets(characters.length)) {
      const fragment = characters.slice(offset, offset + EFFECT_FRAGMENT).join('')
      if (index.owners.get(fragment) !== giftId) continue
      const screenOffset = screen.indexOf(fragment)
      if (screenOffset < 0) continue
      if (matches.some(previous => Math.abs(offset - previous.source) >= 20 &&
        Math.abs(screenOffset - previous.screen) >= 20)) return true
      matches.push({ source: offset, screen: screenOffset })
    }
  }
  return false
}

/** Gifts whose own long effect phrases appear in text read from one popup's effect panel. */
export function effectGiftIds(text: string, catalog: OcrCatalog): string[] {
  const screen = normalized(text.slice(0, 5000))
  if (!screen) return []
  const effects = indexedEffects(catalog)
  return catalog.gifts.filter(gift => uniqueEffectEvidence(gift.id, screen, effects)).map(gift => gift.id)
}

function fragments(value: string): string[] {
  const characters = [...value]
  const result: string[] = []
  for (let offset = 0; offset + 18 <= characters.length; offset += 9) {
    result.push(characters.slice(offset, offset + 18).join(''))
  }
  return result
}

const add = (owners: Map<string, Set<string>>, key: string, id: string) => {
  const ids = owners.get(key)
  if (ids) ids.add(id)
  else owners.set(key, new Set([id]))
}

/**
 * Catalog texts as compared with the screen, built once per catalog (reads arrive every second or so): names, event and
 * choice pieces with their owners.
 */
const catalogCache = new WeakMap<OcrCatalog, {
  gifts: { id: string; names: string[] }[]; nameOwners: Map<string, Set<string>>
  events: { id: string; pieces: string[] }[]; eventFragments: Map<string, Set<string>>
  choices: { id: string; eventId: string; pieces: string[] }[]; choiceOwners: Map<string, Set<string>>
  choiceIdsByEventText: Map<string, Set<string>>
}>()

function indexedCatalog(catalog: OcrCatalog) {
  const cached = catalogCache.get(catalog)
  if (cached) return cached
  const nameOwners = new Map<string, Set<string>>()
  const gifts = catalog.gifts.map(gift => {
    const names = gift.texts.map(normalized).filter(Boolean)
    for (const name of names) add(nameOwners, name, gift.id)
    return { id: gift.id, names }
  })
  const eventFragments = new Map<string, Set<string>>()
  const events = catalog.events.map(event => {
    const pieces = event.texts.flatMap(gameTextPieces)
    for (const piece of pieces) for (const fragment of fragments(piece)) add(eventFragments, fragment, event.id)
    return { id: event.id, pieces }
  })
  const choiceOwners = new Map<string, Set<string>>()
  const choiceIdsByEventText = new Map<string, Set<string>>()
  const choices = catalog.choices.map(choice => {
    const pieces = choice.texts.flatMap(gameTextPieces)
    for (const piece of pieces) {
      add(choiceOwners, piece, choice.eventId)
      add(choiceIdsByEventText, `${choice.eventId}:${piece}`, choice.id)
    }
    return { id: choice.id, eventId: choice.eventId, pieces }
  })
  const index = { gifts, nameOwners, events, eventFragments, choices, choiceOwners, choiceIdsByEventText }
  catalogCache.set(catalog, index)
  return index
}

const finite = (word: OcrWord) => [word.left, word.top, word.width, word.height].every(Number.isFinite) && word.height > 0

/**
 * Text regrouped into its columns: words on one line are joined into rows, and rows sharing a left edge within a line
 * height, each at most 2.5 lines below the last, form a passage read top to bottom. On a two-column screen (event text
 * beside its choices) top-to-bottom order interleaves the columns line by line; here each passage stays whole. Passages
 * are separated by "|", which no normalized catalog text contains.
 */
export function columnText(words: OcrWord[]): string {
  const rows: { text: string; left: number; right: number; top: number; height: number }[] = []
  for (const word of words.filter(word => finite(word) && word.text.trim()).sort((first, second) => first.left - second.left)) {
    const middle = word.top + word.height / 2
    const row = rows.find(item => Math.abs(item.top + item.height / 2 - middle) < Math.max(item.height, word.height) / 2 &&
      word.left >= item.right - item.height / 2 && word.left - item.right < Math.max(item.height, word.height) * 1.5)
    if (row) {
      row.text += ` ${word.text}`
      row.right = Math.max(row.right, word.left + word.width)
    } else rows.push({ text: word.text, left: word.left, right: word.left + word.width, top: word.top, height: word.height })
  }
  rows.sort((first, second) => first.top - second.top || first.left - second.left)
  const passages: { left: number; bottom: number; height: number; lines: string[] }[] = []
  for (const row of rows) {
    const passage = passages.find(item => Math.abs(item.left - row.left) <= Math.max(item.height, row.height) &&
      row.top - item.bottom <= Math.max(item.height, row.height) * 2.5)
    if (passage) {
      passage.lines.push(row.text)
      passage.bottom = row.top + row.height
    } else passages.push({ left: row.left, bottom: row.top + row.height, height: row.height, lines: [row.text] })
  }
  return passages.map(passage => normalized(passage.lines.join(''))).filter(Boolean).join('|')
}

/** The read normalized as shown, then its passages column by column (see columnText); windows never span the "|". */
function screenText(document: OcrDocument): string {
  const screen = normalized(document.text.slice(0, 20000))
  if (!screen) return ''
  const columns = document.words.length ? columnText(document.words.slice(0, 1000)) : ''
  return columns ? `${screen}|${columns}` : screen
}

/** Text evidence only: these candidates never imply acquisition or a clicked choice. */
export function matchOcrCandidates(document: OcrDocument, catalog: OcrCatalog): OcrMatches {
  const text = normalized(document.text.slice(0, 20000))
  if (!text) return { gifts: [], events: [], choices: [] }
  const screen = screenText(document)
  const confidentWords = new Set(document.words
    .filter(word => Number.isFinite(word.confidence) && word.confidence >= 85)
    .map(word => normalized(word.text)))
  const effects = indexedEffects(catalog)
  const index = indexedCatalog(catalog)
  const gifts = index.gifts.filter(gift => gift.names.some(value => {
    const length = contentLength(value)
    if (index.nameOwners.get(value)?.size !== 1) return false
    if (length >= 5) return text.includes(value)
    // Short Latin UI words such as "Gift" occur as labels rather than item names.
    return length >= 3 && /^\p{Script=Hangul}+$/u.test(value) &&
      (confidentWords.has(value) || adjacentShortName(value, document.words))
  }) || uniqueEffectEvidence(gift.id, text, effects)).map(gift => ({ id: gift.id, score: 1 }))

  const events = index.events.filter(event => event.pieces.some(value => {
    if (contentLength(value) < 18) return false
    if (screen.includes(value)) return true
    return fragments(value).some(fragment => index.eventFragments.get(fragment)?.size === 1 && screen.includes(fragment))
  }))
    .map(event => ({ id: event.id, score: 1 }))
  const matchedEventIds = new Set(events.map(event => event.id))
  const choices = index.choices.filter(choice => choice.pieces.some(value => {
    const length = contentLength(value)
    if (length < 4 || !screen.includes(value)) return false
    if (length >= 8) return index.choiceOwners.get(value)?.size === 1 || matchedEventIds.has(choice.eventId)
    return matchedEventIds.has(choice.eventId) && index.choiceIdsByEventText.get(`${choice.eventId}:${value}`)?.size === 1
  }))
    .map(choice => ({ id: choice.id, eventId: choice.eventId, score: 1 }))
  return { gifts, events, choices }
}

export interface EventScreenEvidence {
  /** Short (4–7 glyph) choice texts unique within their own event; meaningful only for an event seen another way. */
  scopedChoices: OcrChoiceMatch[]
  /** Events whose choice result text is on screen, i.e. an outcome page rather than the choice list. */
  outcomeEventIds: string[]
  /** Choices whose own result text is on screen: text no other choice of the same event has (the choice that was taken). */
  outcomeChoiceIds?: string[]
  /** The one event owning two or more distinct choice texts on screen, each used by no other event. */
  choiceEventIds: string[]
  /** The one event owning two or more distinct body text windows on screen, each used by no other event. */
  bodyEventIds: string[]
}

const RESULT_FRAGMENT = 12
const BODY_WINDOW = 10
const scopedCache = new WeakMap<OcrCatalog, { short: Map<string, Map<string, number>>; results: Map<string, string[]>;
  choiceResults: Map<string, string[]>; choiceOwners: Map<string, string | null>; bodyOwners: Map<string, string | null> }>()

function own(owners: Map<string, string | null>, key: string, id: string) {
  const owner = owners.get(key)
  owners.set(key, owner === undefined || owner === id ? id : null)
}

function indexedEventScreens(catalog: OcrCatalog) {
  const cached = scopedCache.get(catalog)
  if (cached) return cached
  const short = new Map<string, Map<string, number>>()
  const results = new Map<string, string[]>()
  const choiceOwners = new Map<string, string | null>()
  const bodyOwners = new Map<string, string | null>()
  const choiceFragments = new Map<string, { eventId: string; fragments: string[] }>()
  for (const event of catalog.events) for (const piece of event.texts.flatMap(gameTextPieces)) {
    const characters = [...piece]
    for (let offset = 0; offset + BODY_WINDOW <= characters.length; offset++) {
      own(bodyOwners, characters.slice(offset, offset + BODY_WINDOW).join(''), event.id)
    }
  }
  for (const choice of catalog.choices) {
    const pieces = new Set(choice.texts.flatMap(gameTextPieces))
    for (const value of pieces) if (contentLength(value) >= 4) own(choiceOwners, value, choice.eventId)
    const counts = short.get(choice.eventId) ?? new Map<string, number>()
    for (const value of pieces) counts.set(value, (counts.get(value) ?? 0) + 1)
    short.set(choice.eventId, counts)
    const fragments = results.get(choice.eventId) ?? []
    const mine: string[] = []
    for (const piece of (choice.resultTexts ?? []).flatMap(gameTextPieces)) {
      const characters = [...piece]
      if (characters.length >= 8 && characters.length < RESULT_FRAGMENT) mine.push(characters.join(''))
      for (let offset = 0; offset + RESULT_FRAGMENT <= characters.length; offset += RESULT_FRAGMENT / 2) {
        mine.push(characters.slice(offset, offset + RESULT_FRAGMENT).join(''))
      }
    }
    fragments.push(...mine)
    results.set(choice.eventId, fragments)
    choiceFragments.set(choice.id, { eventId: choice.eventId, fragments: mine })
  }
  // a choice's result fragments that no other choice of its event shares: on screen, they name the choice taken
  const choiceResults = new Map<string, string[]>()
  for (const [id, { eventId, fragments }] of choiceFragments) {
    const others = new Set([...choiceFragments].filter(([other, entry]) => other !== id && entry.eventId === eventId).flatMap(([, entry]) => entry.fragments))
    choiceResults.set(id, fragments.filter(fragment => !others.has(fragment)))
  }
  const index = { short, results, choiceResults, choiceOwners, bodyOwners }
  scopedCache.set(catalog, index)
  return index
}

/** Evidence that needs an image- or text-identified event before it can name the event on screen. */
export function eventScreenEvidence(document: OcrDocument, catalog: OcrCatalog): EventScreenEvidence {
  const screen = screenText(document)
  if (!screen) return { scopedChoices: [], outcomeEventIds: [], choiceEventIds: [], bodyEventIds: [] }
  const index = indexedEventScreens(catalog)
  const catalogIndex = indexedCatalog(catalog)
  const scopedChoices = catalogIndex.choices.filter(choice => choice.pieces.some(value => {
    const length = contentLength(value)
    return length >= 4 && length < 8 && screen.includes(value) && index.short.get(choice.eventId)?.get(value) === 1
  })).map(choice => ({ id: choice.id, eventId: choice.eventId, score: 1 }))
  const outcomeEventIds = [...index.results].filter(([, fragments]) => fragments.some(fragment => screen.includes(fragment)))
    .map(([eventId]) => eventId)
  const outcomeChoiceIds = [...index.choiceResults].filter(([, fragments]) => fragments.some(fragment => screen.includes(fragment)))
    .map(([choiceId]) => choiceId)
  const choiceHits = new Map<string, Set<string>>()
  for (const [text, owner] of index.choiceOwners) {
    if (owner && screen.includes(text)) choiceHits.set(owner, (choiceHits.get(owner) ?? new Set()).add(text))
  }
  const bodyHits = new Map<string, Set<string>>()
  const characters = [...screen]
  for (let offset = 0; offset + BODY_WINDOW <= characters.length; offset++) {
    const window = characters.slice(offset, offset + BODY_WINDOW).join('')
    const owner = index.bodyOwners.get(window)
    if (owner) bodyHits.set(owner, (bodyHits.get(owner) ?? new Set()).add(window))
  }
  // Several events each reaching two hits is ambiguous, so neither is named.
  const single = (hits: Map<string, Set<string>>) => {
    const ids = [...hits].filter(([, texts]) => texts.size >= 2).map(([id]) => id)
    return ids.length === 1 ? ids : []
  }
  return { scopedChoices, outcomeEventIds, outcomeChoiceIds, choiceEventIds: single(choiceHits), bodyEventIds: single(bodyHits) }
}

/**
 * The single event whose choices are on screen. Every choice candidate is first limited to events the image matcher or
 * event text already identified; several remaining events, or a result page of that event, abstain.
 */
export function corroboratedChoiceEvent({ choices, scopedChoices = [], outcomeEventIds = [], corroboratedEventIds }: {
  choices: { eventId: string }[]
  scopedChoices?: { eventId: string }[]
  outcomeEventIds?: string[]
  corroboratedEventIds: string[]
}): string | null {
  const corroborated = new Set(corroboratedEventIds)
  const candidates = [...new Set([...choices, ...scopedChoices].map(choice => choice.eventId))].filter(id => corroborated.has(id))
  if (candidates.length !== 1 || outcomeEventIds.includes(candidates[0])) return null
  return candidates[0]
}
