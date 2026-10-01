/** Rebuild the event graph solely from preserved Drive inputs. Default: plan + audit. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { eventImageId } from '../assets/event-image-source'
import { implicitDataDirWarning } from './source-paths'
import { eventText, identicalEventCopies, sequenceEventIds, sinnerCharacterId, sourceResults, sourceResultText, walkEventGraph, type SourceEvent, type SourceForm } from './mirror-event-source'
config({ path: '.env.local', quiet: true })
type Locale = 'ko' | 'en' | 'ja'
type Text = { id: number; name?: string; title?: string; desc?: string; behaveDesc?: string; prevDesc?: string; eventDesc?: string; successDesc?: string[]; failureDesc?: string[]; options?: { message?: string; messageDesc?: string; result?: string[] }[] }
const langs = { ko: 'KR', en: 'EN', ja: 'JP' } as const
const recovery = resolve(process.env.LIMBUS_RECOVERY_DIR || '../assets/recovery-2026-09-10')
const dataDir = resolve(process.env.LIMBUS_DATA_DIR || join(recovery, 'complete-data'))
const templateDir = join(recovery, 'event-text-originals')
// Prepared extracts (apply-extraction.ts) keep locales in KR/EN/JP and carry the choice templates there.
const localeDir = (prefix: string) => existsSync(join(dataDir, prefix)) ? join(dataDir, prefix) : dataDir
const templateFile = (prefix: string, name: string) => existsSync(join(templateDir, `${prefix}_${name}.json`))
  ? join(templateDir, `${prefix}_${name}.json`) : join(localeDir(prefix), `${prefix}_${name}.txt`)
const provenance: { file: string; sha256: string }[] = []
function read<T>(path: string): T {
  const bytes = readFileSync(path)
  provenance.push({ file: path, sha256: createHash('sha256').update(bytes).digest('hex') })
  return JSON.parse(bytes.toString()) as T
}
const bank = (file: string) => Object.fromEntries(read<{ dataList: { id: string; content: string }[] }>(file).dataList.map(x => [x.id, x.content]))
const attributes: Record<string, [string, string, string]> = {
  CRIMSON: ['분노', 'Wrath', '憤怒'], SCARLET: ['색욕', 'Lust', '色欲'], AMBER: ['나태', 'Sloth', '怠惰'],
  SHAMROCK: ['탐식', 'Gluttony', '暴食'], AZURE: ['우울', 'Gloom', '憂鬱'], INDIGO: ['오만', 'Pride', '傲慢'], VIOLET: ['질투', 'Envy', '嫉妬'],
}
const localeIndex = { ko: 0, en: 1, ja: 2 }

export async function rebuildMirrorEvents(apply = process.argv.includes('--fix')) {
  const pathWarning = implicitDataDirWarning('이벤트', dataDir)
  if (pathWarning) console.warn(pathWarning)
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const db = client.schema('limbus')
  const { data: gifts, error } = await db.from('ego_gifts').select('game_id,name,name_en,name_jp')
  if (error) throw error
  const giftById = new Map(gifts.map(g => [g.game_id as number, g]))
  const { data: identities, error: identityError } = await db.from('identities').select('game_id,name_kr,name_en,name_jp')
  if (identityError) throw identityError
  const identityById = new Map(identities.map(i => [Number(i.game_id), i]))
  const unitLabels = {} as Record<Locale, Record<string, string>>
  const characterLabels = {} as Record<Locale, Record<number, string>>
  const raw = ['mirror-dungeon-action-choice-event.txt', 'mirror-dungeon-personality-choice-event.txt']
    .flatMap(file => read<{ list: SourceEvent[] }>(join(dataDir, file)).list)
  const nodes = new Map(raw.map(node => [node.id, node]))
  if (nodes.size !== raw.length) throw Error('Duplicate static event ID')
  const texts = {} as Record<Locale, Map<number, { text: Text; file: string }>>
  const effects = {} as Record<Locale, Record<string, string>>
  const targets = {} as typeof effects, keywords = {} as typeof effects
  for (const [lang, prefix] of Object.entries(langs) as [Locale, string][]) {
    texts[lang] = new Map()
    const dir = localeDir(prefix)
    unitLabels[lang] = Object.assign({}, ...readdirSync(dir).filter(f => f.startsWith(`${prefix}_UnitKeyword`) && f.endsWith('.txt')).sort().map(f => bank(join(dir, f))))
    characterLabels[lang] = Object.fromEntries(read<{dataList: {id: number; name: string}[]}>(join(dir, `${prefix}_Characters.txt`)).dataList.map(x => [x.id, x.name]))
    for (const file of readdirSync(dir).filter(f => new RegExp(`^${prefix}_(ActionEvents|AbEvents)(?!ResultLog).*\\.txt$`).test(f)).sort()) {
      for (const text of (read<{ dataList?: Text[] }>(join(dir, file)).dataList ?? [])) {
        if (!nodes.has(text.id)) continue
        const previous = texts[lang].get(text.id)
        if (previous && JSON.stringify(previous.text) !== JSON.stringify(text)) throw Error(`Conflicting ${lang} source text: ${text.id}`)
        texts[lang].set(text.id, { text, file })
      }
    }
    effects[lang] = bank(templateFile(prefix, 'ChoiceEventEffect'))
    targets[lang] = bank(templateFile(prefix, 'ChoiceEventTarget'))
    keywords[lang] = bank(templateFile(prefix, 'ChoiceEventKeyword'))
  }
  const entries = new Set<number>(), themeByEntry = new Map<number, Set<number>>()
  function addEntry(id: number, theme: number) {
    if (id <= 0) return
    entries.add(id)
    if (!themeByEntry.has(id)) themeByEntry.set(id, new Set())
    themeByEntry.get(id)!.add(theme)
  }
  function fixedEntries(value: unknown, theme: number) {
    if (Array.isArray(value)) { value.forEach(x => fixedEntries(x, theme)); return }
    if (!value || typeof value !== 'object') return
    const node = value as Record<string, unknown>
    if (node.encounterType === 3 && typeof node.encounterId === 'number') addEntry(node.encounterId, theme)
    Object.values(node).forEach(x => fixedEntries(x, theme))
  }
  for (const file of readdirSync(dataDir).filter(f => /^mirrordungeon-theme-floor-(t\d+|hidden)\.txt$/.test(f))) {
    const source = read<{ list: { id: number; mapGenOption?: { eventPool?: number[]; specialEventPool?: number[] }; mapGenSequence?: unknown }[] }>(join(dataDir, file))
    for (const theme of source.list) {
      for (const id of [...(theme.mapGenOption?.eventPool ?? []), ...(theme.mapGenOption?.specialEventPool ?? [])]) addEntry(id, theme.id)
      fixedEntries(theme.mapGenSequence, theme.id)
      for (const id of sequenceEventIds(theme.mapGenSequence)) addEntry(id, theme.id)
    }
  }
  const graph = walkEventGraph(nodes, entries)
  const imageIds = new Set<number>()
  if (existsSync(join(recovery, 'mirror-assets-upload.json'))) {
    for (const r of read<{ target: string }[]>(join(recovery, 'mirror-assets-upload.json'))) {
      const id = /^icons\/events\/(\d+)\.webp$/.exec(r.target)?.[1]
      if (id) imageIds.add(Number(id))
    }
  } else {
    // Without an upload receipt, the bucket itself says which event art exists.
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: listError } = await client.storage.from('limbus-assets').list('icons/events', { limit: 1000, offset })
      if (listError) throw listError
      for (const file of files) if (/^\d+\.webp$/.test(file.name)) imageIds.add(Number(file.name.slice(0, -5)))
      if (files.length < 1000) break
    }
  }
  const assetBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/limbus-assets`
  const missingTemplates = new Set<string>(), missingGifts = new Set<number>()
  function effectText(form: SourceForm, lang: Locale) {
    const rawEffect = form.resultEffect ?? 'Empty'
    const numeric = rawEffect.match(/^(.+?)_(-?\d+)(?:_(-?\d+))?$/)
    const key = form.resultDescId && effects[lang][form.resultDescId] != null ? form.resultDescId
      : effects[lang][rawEffect] != null ? rawEffect : numeric?.[1] ?? rawEffect
    let template = effects[lang][key]
    if (template == null) {
      // Ratio effects use the source stat template with a percentage amount.
      const ratioKey = key.replace('RatioHpOnly', 'HpOnly')
      template = effects[lang][ratioKey]
    }
    if (template == null) { missingTemplates.add(`${lang}:${key}`); return '' }
    const condition = (form.resultEffectCondition1 ?? '').split('_')
    const attributesText = (condition[1] ?? '').split(',').map(a => attributes[a]?.[localeIndex[lang]] ?? a).join(' / ')
    let conditionText = keywords[lang][condition[0]]?.replace('[ATTRIBUTES]', attributesText) ?? ''
    if (conditionText) conditionText += ' '
    const target = (form.resultEffectTarget ?? '').split('_')
    let targetText = targets[lang][target[0]] ?? ({ Ryosyu: ['료슈', 'Ryoshu', '良秀'], Donquixote: ['돈키호테', 'Don Quixote', 'ドンキホーテ'] } as Record<string, string[]>)[target[0]]?.[localeIndex[lang]] ?? ''
    if (target[1]) targetText += lang === 'en' ? ` ×${target[1]}` : ` ${target[1]}${lang === 'ko' ? '명' : '名'}`
    const rewardId = form.itemReward?.rewardId
    const gift = rewardId ? giftById.get(rewardId) : null
    const giftName = gift ? (lang === 'en' ? gift.name_en : lang === 'ja' ? gift.name_jp : gift.name) || gift.name : ''
    const amount = numeric?.[2] ?? form.itemReward?.num ?? 0
    const values: Record<string, string | number> = {
      conditions: conditionText, targets: targetText, amount: key.includes('Ratio') ? `${amount}%` : amount,
      hpAmount: numeric?.[2] ?? 0, mpAmount: numeric?.[3] ?? 0, reward: giftName ? `"${giftName}"` : '', stack: form.itemReward?.num ?? 1,
    }
    return template.replace(/\{(\w+)\}/g, (match, token: string) => token in values ? String(values[token]) : match)
  }
  function compileEffect(form: SourceForm) {
    const id = form.itemReward?.type === 'EGO_GIFT' ? form.itemReward.rewardId : undefined
    if (id && id < 990000 && !giftById.has(id)) missingGifts.add(id)
    return {
      type: 'source', source: form,
      text: Object.fromEntries((Object.keys(langs) as Locale[]).map(lang => [lang, effectText(form, lang)])),
      ...(id && id < 990000 && form.resultDescId !== 'Choice_LoseBattle' ? { gift_id: id } : {}),
    }
  }
  const rows: Record<string, unknown>[] = [], choices: Record<string, unknown>[] = []
  const missingKorean: number[] = []
  for (const id of [...graph.reachable].sort((a, b) => a - b)) {
    const node = nodes.get(id)!
    const ko = texts.ko.get(id), en = texts.en.get(id), ja = texts.ja.get(id)
    if (!ko) missingKorean.push(id)
    const base = ko ?? en ?? ja
    if (!base) throw Error(`No source localization for ${id}`)
    const coin = node.eventType === 'COIN_EVENT'
    const ownResults = sourceResults(node)
    const descendants = walkEventGraph(nodes, new Set([id])).reachable
    const giftIds = new Set<number>()
    for (const child of descendants) for (const { result } of sourceResults(nodes.get(child)!)) {
      for (const { resultForm: form } of result.eventResultDataList ?? []) {
        if (form?.itemReward?.type === 'EGO_GIFT' && form.itemReward.rewardId && form.itemReward.rewardId < 990000) giftIds.add(form.itemReward.rewardId)
      }
    }
    const imageId = eventImageId(id, node.illustId)
    const { eventResults: _results, ...judgment } = node.personalityEvent ?? {}
    const intro = Object.fromEntries((Object.keys(langs) as Locale[]).map(lang => {
      const text = (texts[lang].get(id) ?? base!).text
      return [lang, [text.prevDesc, text.eventDesc].filter(Boolean).join('\n\n')]
    }))
    const hasIntro = Object.values(intro).some(Boolean)
    const corrections = ((judgment.adderInfo ?? []) as {correctionCase: string; adder: number}[]).map(correction => {
      const separator = correction.correctionCase.indexOf('_')
      const type = correction.correctionCase.slice(0, separator), keys = correction.correctionCase.slice(separator + 1).split(',')
      return { ...correction, labels: Object.fromEntries((Object.keys(langs) as Locale[]).map(lang => [lang, keys.map(key => {
        if (type === 'SpecificUnit') {
          const label = characterLabels[lang][sinnerCharacterId(key)]
          if (!label) throw Error(`Missing sinner label ${lang}:${key}`)
          return label
        }
        if (type === 'SpecificPersonality') {
          const identity = identityById.get(Number(key))
          if (!identity) throw Error(`Missing judgment identity ${key}`)
          return (lang === 'en' ? identity.name_en : lang === 'ja' ? identity.name_jp : identity.name_kr) ?? identity.name_kr
        }
        const label = unitLabels[lang][`UnitKeyword_${key}`]
        if (!label) throw Error(`Missing judgment label ${lang}:${key}`)
        return label
      }).join(' / ')])) }
    })
    rows.push({
      id, name: base.text.name ?? base.text.title ?? '', name_en: en?.text.name ?? en?.text.title ?? null, name_jp: ja?.text.name ?? ja?.text.title ?? null,
      desc_text: eventText((coin ? base.text.behaveDesc : base.text.desc) ?? ''),
      desc_text_en: eventText((coin ? en?.text.behaveDesc : en?.text.desc) ?? null), desc_text_jp: eventText((coin ? ja?.text.behaveDesc : ja?.text.desc) ?? null),
      event_type: coin ? 'ab' : 'action', category: entries.has(id) ? 'entry' : 'continuation',
      source: base.file, variant_of: null, theme_ids: [...(themeByEntry.get(id) ?? [])], gift_ids: [...giftIds].sort((a, b) => a - b),
      image_url: imageIds.has(imageId) ? `${assetBase}/icons/events/${imageId}.webp` : null,
      judgment: coin ? { ...judgment, corrections, ...(hasIntro ? { intro } : {}) } : null,
    })
    for (const { optionIndex, outcome, result } of ownResults) {
      function localized(lang: Locale) {
        const text = (texts[lang].get(id) ?? base!).text
        if (coin) return { message: ({ ko: ['성공', '실패'], en: ['Success', 'Failure'], ja: ['成功', '失敗'] }[lang])[outcome === 'success' ? 0 : 1],
          message_desc: null, result_text: sourceResultText(outcome === 'success' ? text.successDesc : text.failureDesc, result.resultIndex) }
        const option = text.options?.[optionIndex]
        return { message: option?.message ?? null, message_desc: option?.messageDesc ?? null, result_text: sourceResultText(option?.result, result.resultIndex) }
      }
      const koChoice = localized('ko'), enChoice = localized('en'), jaChoice = localized('ja')
      choices.push({ event_id: id, sort_order: optionIndex * 100 + result.resultIndex,
        selection_condition: node.actionEvent?.eachOptionList?.find(o => o.index === optionIndex)?.cantSelectInThisCase ?? null,
        option_index: optionIndex, result_index: result.resultIndex, outcome, result_condition: result.resultCondition ?? null,
        ...koChoice, message_en: enChoice.message, message_jp: jaChoice.message, message_desc_en: enChoice.message_desc, message_desc_jp: jaChoice.message_desc,
        result_text_en: enChoice.result_text, result_text_jp: jaChoice.result_text,
        next_event_id: result.nextEventID && result.nextEventID > 0 ? result.nextEventID : null,
        probability: /^Prob_([\d.]+)$/.exec(result.resultCondition ?? '')?.[1] ?? result.resultCondition ?? null,
        effects: (result.eventResultDataList ?? []).flatMap(r => r.resultForm ? [compileEffect(r.resultForm)] : []),
      })
    }
  }
  // Exact copies of one event (source and all three languages) point at the lowest ID and show its art.
  const copies = identicalEventCopies([...graph.reachable].map(id => nodes.get(id)!),
    id => JSON.stringify((Object.keys(langs) as Locale[]).map(lang => { const { id: _id, ...text } = texts[lang].get(id)?.text ?? { id }; return text })))
  const rowById = new Map(rows.map(row => [row.id as number, row]))
  for (const [id, first] of copies) {
    const row = rowById.get(id)!
    row.variant_of = first
    row.image_url ??= rowById.get(first)!.image_url
  }
  const audit = { inputs: provenance, nodes: rows.length, choices: choices.length, entries: entries.size, edges: graph.edges, copies: Object.fromEntries(copies),
    missingKorean, missingTemplates: [...missingTemplates], missingGifts: [...missingGifts],
    missingEntryImages: rows.filter(r => r.category === 'entry' && !r.image_url).map(r => r.id) }
  const output = join(recovery, 'event-graph-rebuild'); mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'events.json'), JSON.stringify(rows, null, 2))
  writeFileSync(join(output, 'choices.json'), JSON.stringify(choices, null, 2))
  writeFileSync(join(output, 'audit.json'), JSON.stringify(audit, null, 2))
  console.log(JSON.stringify({ ...audit, inputs: provenance.length, edges: graph.edges.length }))
  if (missingTemplates.size || missingGifts.size) throw Error('Unresolved source references; inspect audit before replacement')
  if (apply) {
    const backup = join(recovery, 'before-event-graph-rebuild'); mkdirSync(backup, { recursive: true })
    for (const table of ['md_events', 'md_event_choices']) {
      const { data, error: readError } = await db.from(table).select('*').order('id')
      if (readError) throw readError
      if (!existsSync(join(backup, `${table}.json`))) writeFileSync(join(backup, `${table}.json`), JSON.stringify(data, null, 2))
    }
    const { data, error: replaceError } = await db.rpc('replace_md_event_graph', { p_events: rows, p_choices: choices })
    if (replaceError) throw replaceError
    console.log('Replaced graph atomically:', data)
    const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
    for (const [table, expected] of [['md_events', rows], ['md_event_choices', choices]] as const) {
      const { data: actual, error: readbackError } = await db.from(table).select('*')
      if (readbackError) throw readbackError
      const fields = Object.keys(expected[0])
      const normalize = (record: Record<string, unknown>) => canonical(Object.fromEntries(fields.map(field => [field, record[field]])))
      if (canonical(expected.map(normalize).sort()) !== canonical(actual.map(normalize).sort())) throw Error(`Readback differs for ${table}`)
      writeFileSync(join(output, `${table}-verified.json`), JSON.stringify(actual, null, 2))
    }
    writeFileSync(join(output, 'applied.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), ...data }))
    console.log('Verified every rebuilt event and choice field against the plan')
    if (process.env.SITE_URL && process.env.REVALIDATION_SECRET) {
      const response = await fetch(`${process.env.SITE_URL}/api/revalidate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-revalidation-secret': process.env.REVALIDATION_SECRET },
        body: JSON.stringify({ scope: 'all-game-data', paths: ['/ko/mirror-dungeon', '/en/mirror-dungeon', '/ja/mirror-dungeon'] }),
      })
      if (!response.ok) throw Error(`Graph verified, but cache revalidation failed (${response.status}); retry revalidation without replacing the graph`)
      console.log('Invalidated event and gift caches on the requested server')
    } else console.warn('Graph verified; set SITE_URL and REVALIDATION_SECRET to invalidate the serving site cache')
  }
}
if (/rebuild-mirror-events\.(ts|mjs)$/.test(process.argv[1] ?? '')) rebuildMirrorEvents().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
