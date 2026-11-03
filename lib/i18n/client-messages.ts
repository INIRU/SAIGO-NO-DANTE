import type { AbstractIntlMessages } from 'next-intl'

/**
 * Message subtrees read only by one route section's client code. The root layout leaves them out of every page and
 * that section's layout adds them back (SectionMessages), so a page carries only the messages it can use.
 * Server components are unaffected: getTranslations reads the full catalog on the server.
 */
export const SECTION_MESSAGES = {
  planner: ['planner.run', 'planner.floorTab', 'planner.blessingTab', 'planner.finalPresets'],
  meta: ['meta'],
  random: ['randomPage'],
  prescript: ['prescriptMode'],
  motion: ['motionPage'],
  login: ['loginPage'],
  admin: ['adminShell'],
} as const

type Messages = AbstractIntlMessages
const isObject = (value: unknown): value is Messages => typeof value === 'object' && value !== null

/** Copy of \`messages\` without the given dotted paths. */
export function omitMessages(messages: Messages, paths: readonly string[]): Messages {
  const out: Messages = { ...messages }
  for (const path of paths) {
    const keys = path.split('.')
    let node = out
    for (const key of keys.slice(0, -1)) {
      if (!isObject(node[key])) { node = {}; break }
      node = node[key] = { ...(node[key] as Messages) }
    }
    delete node[keys[keys.length - 1]]
  }
  return out
}

/** Only the given dotted paths of \`messages\`, nested as in the catalog. */
export function pickMessages(messages: Messages, paths: readonly string[]): Messages {
  const out: Messages = {}
  for (const path of paths) {
    const keys = path.split('.')
    let source: unknown = messages
    for (const key of keys) source = isObject(source) ? source[key] : undefined
    if (source === undefined) continue
    let node = out
    for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Messages
    node[keys[keys.length - 1]] = source as Messages
  }
  return out
}

/** \`extra\` merged into \`base\` (objects deeply, leaves replaced). */
export function mergeMessages(base: Messages, extra: Messages): Messages {
  const out: Messages = { ...base }
  for (const [key, value] of Object.entries(extra)) out[key] = isObject(value) && isObject(out[key]) ? mergeMessages(out[key] as Messages, value) : value
  return out
}

export const ROOT_OMITTED_MESSAGES = Object.values(SECTION_MESSAGES).flat()
