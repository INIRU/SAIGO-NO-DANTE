import { NOTE_PREFIX } from '@/lib/notes/blocks'

export type TranslateLang = 'ko' | 'en' | 'ja'
type Node = { type?: string; text?: string; content?: Node[]; [key: string]: unknown }

/** Rough source language of user text: Hangul → ko, kana → ja, Latin letters → en. */
export function textLanguage(text: string): TranslateLang | null {
  if (/[\uac00-\ud7a3]/.test(text)) return 'ko'
  if (/[\u3040-\u30ff]/.test(text)) return 'ja'
  if (/[A-Za-z]{2}/.test(text)) return 'en'
  return null
}

function noteDoc(text: string): Node | null {
  if (!text.startsWith(NOTE_PREFIX)) return null
  try { return JSON.parse(text.slice(NOTE_PREFIX.length)) as Node } catch { return null }
}

/** Translatable pieces of a user text: the text nodes of a block note, or the whole markdown text. */
export function segmentsOf(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  const doc = noteDoc(text)
  if (!doc) return [text]
  const out: string[] = []
  const walk = (node: Node) => {
    if (node.type === 'text' && typeof node.text === 'string' && node.text.trim()) out.push(node.text)
    node.content?.forEach(walk)
  }
  walk(doc)
  return out
}

/** The same text with every piece that has a translation replaced; structure, blocks and marks stay. */
export function applyTranslations(text: string, translations: ReadonlyMap<string, string>): string {
  if (!translations.size || !text) return text
  const doc = noteDoc(text)
  if (!doc) return translations.get(text) ?? text
  const walk = (node: Node): Node => node.type === 'text' && typeof node.text === 'string'
    ? { ...node, text: translations.get(node.text) ?? node.text }
    : node.content ? { ...node, content: node.content.map(walk) } : node
  return NOTE_PREFIX + JSON.stringify(walk(doc))
}

/** Unique pieces across fields, in order. */
export const uniqueSegments = (texts: (string | null | undefined)[]) => [...new Set(texts.flatMap(segmentsOf))]
