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

const normalized = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const contentLength = (value: string) => [...value].length
const effectNormalized = (value: string) => normalized(value.replace(/<\/?color\b[^>]*>/gi, ''))
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
    const effects = (gift.effectTexts ?? []).map(effectNormalized).filter(Boolean)
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

/** Text evidence only: these candidates never imply acquisition or a clicked choice. */
export function matchOcrCandidates(document: OcrDocument, catalog: OcrCatalog): OcrMatches {
  const screen = normalized(document.text.slice(0, 20000))
  if (!screen) return { gifts: [], events: [], choices: [] }
  const confidentWords = new Set(document.words
    .filter(word => Number.isFinite(word.confidence) && word.confidence >= 85)
    .map(word => normalized(word.text)))
  const effects = indexedEffects(catalog)
  const giftNames = new Map<string, Set<string>>()
  for (const gift of catalog.gifts) for (const name of gift.texts) {
    const key = normalized(name)
    if (!key) continue
    const owners = giftNames.get(key) ?? new Set<string>()
    owners.add(gift.id)
    giftNames.set(key, owners)
  }
  const gifts = catalog.gifts.filter(gift => gift.texts.some(name => {
    const value = normalized(name)
    const length = contentLength(value)
    if (giftNames.get(value)?.size !== 1) return false
    if (length >= 5) return screen.includes(value)
    // Short Latin UI words such as "Gift" occur as labels rather than item names.
    return length >= 3 && /^\p{Script=Hangul}+$/u.test(value) &&
      (confidentWords.has(value) || adjacentShortName(value, document.words))
  }) || uniqueEffectEvidence(gift.id, screen, effects)).map(gift => ({ id: gift.id, score: 1 }))

  const eventFragments = new Map<string, Set<string>>()
  for (const event of catalog.events) for (const text of event.texts) {
    const value = normalized(text)
    for (const fragment of fragments(value)) {
      const owners = eventFragments.get(fragment) ?? new Set<string>()
      owners.add(event.id)
      eventFragments.set(fragment, owners)
    }
  }
  const events = catalog.events.filter(event => event.texts.some(text => {
    const value = normalized(text)
    if (contentLength(value) < 18) return false
    if (screen.includes(value)) return true
    return fragments(value).some(fragment => eventFragments.get(fragment)?.size === 1 && screen.includes(fragment))
  }))
    .map(event => ({ id: event.id, score: 1 }))
  const matchedEventIds = new Set(events.map(event => event.id))
  const choiceOwners = new Map<string, Set<string>>()
  const choiceIdsByEventText = new Map<string, Set<string>>()
  for (const choice of catalog.choices) for (const text of choice.texts) {
    const value = normalized(text)
    if (!value) continue
    const owners = choiceOwners.get(value) ?? new Set<string>()
    owners.add(choice.eventId)
    choiceOwners.set(value, owners)
    const eventText = `${choice.eventId}:${value}`
    const ids = choiceIdsByEventText.get(eventText) ?? new Set<string>()
    ids.add(choice.id)
    choiceIdsByEventText.set(eventText, ids)
  }
  const choices = catalog.choices.filter(choice => choice.texts.some(text => {
    const value = normalized(text)
    const length = contentLength(value)
    if (length < 4 || !screen.includes(value)) return false
    if (length >= 8) return choiceOwners.get(value)?.size === 1 || matchedEventIds.has(choice.eventId)
    return matchedEventIds.has(choice.eventId) && choiceIdsByEventText.get(`${choice.eventId}:${value}`)?.size === 1
  }))
    .map(choice => ({ id: choice.id, eventId: choice.eventId, score: 1 }))
  return { gifts, events, choices }
}

export interface EventScreenEvidence {
  /** Short (4–7 glyph) choice texts unique within their own event; meaningful only for an event seen another way. */
  scopedChoices: OcrChoiceMatch[]
  /** Events whose choice result text is on screen, i.e. an outcome page rather than the choice list. */
  outcomeEventIds: string[]
  /** The one event owning two or more distinct choice texts on screen, each used by no other event. */
  choiceEventIds: string[]
  /** The one event owning two or more distinct body text windows on screen, each used by no other event. */
  bodyEventIds: string[]
}

const RESULT_FRAGMENT = 12
const BODY_WINDOW = 10
const scopedCache = new WeakMap<OcrCatalog, { short: Map<string, Map<string, number>>; results: Map<string, string[]>;
  choiceOwners: Map<string, string | null>; bodyOwners: Map<string, string | null> }>()

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
  for (const event of catalog.events) for (const text of event.texts) {
    const characters = [...normalized(text)]
    for (let offset = 0; offset + BODY_WINDOW <= characters.length; offset++) {
      own(bodyOwners, characters.slice(offset, offset + BODY_WINDOW).join(''), event.id)
    }
  }
  for (const choice of catalog.choices) {
    for (const text of choice.texts) {
      const value = normalized(text)
      if (contentLength(value) >= 4) own(choiceOwners, value, choice.eventId)
    }
    const counts = short.get(choice.eventId) ?? new Map<string, number>()
    for (const text of new Set(choice.texts.map(normalized))) counts.set(text, (counts.get(text) ?? 0) + 1)
    short.set(choice.eventId, counts)
    const fragments = results.get(choice.eventId) ?? []
    for (const text of choice.resultTexts ?? []) {
      const characters = [...normalized(text)]
      if (characters.length >= 8 && characters.length < RESULT_FRAGMENT) fragments.push(characters.join(''))
      for (let offset = 0; offset + RESULT_FRAGMENT <= characters.length; offset += RESULT_FRAGMENT / 2) {
        fragments.push(characters.slice(offset, offset + RESULT_FRAGMENT).join(''))
      }
    }
    results.set(choice.eventId, fragments)
  }
  const index = { short, results, choiceOwners, bodyOwners }
  scopedCache.set(catalog, index)
  return index
}

/** Evidence that needs an image- or text-identified event before it can name the event on screen. */
export function eventScreenEvidence(document: OcrDocument, catalog: OcrCatalog): EventScreenEvidence {
  const screen = normalized(document.text.slice(0, 20000))
  if (!screen) return { scopedChoices: [], outcomeEventIds: [], choiceEventIds: [], bodyEventIds: [] }
  const index = indexedEventScreens(catalog)
  const scopedChoices = catalog.choices.filter(choice => choice.texts.some(text => {
    const value = normalized(text)
    const length = contentLength(value)
    return length >= 4 && length < 8 && screen.includes(value) && index.short.get(choice.eventId)?.get(value) === 1
  })).map(choice => ({ id: choice.id, eventId: choice.eventId, score: 1 }))
  const outcomeEventIds = [...index.results].filter(([, fragments]) => fragments.some(fragment => screen.includes(fragment)))
    .map(([eventId]) => eventId)
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
  return { scopedChoices, outcomeEventIds, choiceEventIds: single(choiceHits), bodyEventIds: single(bodyHits) }
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
