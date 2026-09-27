import type { JSONContent } from '@tiptap/core'
import { isNoteImageUrl } from './images'

export const NOTE_PREFIX = '!limbus-note:v1\n'
export const ASSET_KINDS = ['gift', 'theme', 'identity', 'ego', 'skill', 'sin', 'keyword'] as const
export type AssetKind = typeof ASSET_KINDS[number]
export type BlockKind = AssetKind | 'accordion' | 'youtube'
export const BLOCK_LABELS: Record<BlockKind, [string, string, string]> = {
  gift: ['기프트', 'ギフト', 'Gift'], theme: ['테마팩', 'テーマパック', 'Theme pack'],
  identity: ['인격', '人格', 'Identity'], ego: ['E.G.O', 'E.G.O', 'E.G.O'],
  skill: ['스킬', 'スキル', 'Skill'], sin: ['죄악', '罪悪', 'Sin'],
  keyword: ['키워드', 'キーワード', 'Keyword'], accordion: ['아코디언', 'アコーディオン', 'Accordion'],
  youtube: ['유튜브', 'YouTube', 'YouTube'],
}
export function blockLabel(kind: BlockKind, lang: string) {
  return BLOCK_LABELS[kind][lang === 'ja' ? 1 : lang === 'en' ? 2 : 0]
}
export function isAssetKind(value: unknown): value is AssetKind {
  return ASSET_KINDS.includes(value as AssetKind)
}
export function youtubeId(value: string): string | null {
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.username || u.password) return null
    let id: string | null = null
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1)
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname)) {
      id = u.pathname === '/watch' ? u.searchParams.get('v') : u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1] ?? null
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch { return null }
}
export function newBlock(kind: BlockKind): JSONContent {
  if (kind === 'accordion') return { type: 'noteAccordion', content: [
    { type: 'noteTitle' }, { type: 'noteBody', content: [{ type: 'paragraph' }] },
  ] }
  if (kind === 'keyword') return {type:'noteKeyword',attrs:{id:''}}
  return kind === 'youtube' ? { type: 'noteVideo', attrs: { videoId: '' } }
    : { type: 'noteAsset', attrs: { kind, id: '' } }
}
const TYPES = new Set(['doc', 'paragraph', 'heading', 'text', 'hardBreak', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'codeBlock', 'horizontalRule', 'image', 'noteAccordion', 'noteTitle', 'noteBody', 'noteAsset', 'noteVideo', 'noteKeyword', 'noteGift'])
const INLINE_TYPES = new Set(['text', 'hardBreak', 'noteKeyword', 'noteGift'])
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'codeBlock', 'horizontalRule', 'image', 'noteAccordion', 'noteAsset', 'noteVideo'])
// The same bounded allowlist is used for persisted documents and pasted editor nodes.
export function normalizeDocument(value: unknown): JSONContent | null {
  let count = 0
  function node(raw: unknown, depth: number): JSONContent | null {
    if (!raw || typeof raw !== 'object' || depth > 24 || ++count > 2000) throw Error('Invalid document')
    const n = raw as JSONContent
    if (!n.type || !TYPES.has(n.type)) return null
    const result: JSONContent = { type: n.type }
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || !n.text) return null
      result.text = n.text
      result.marks = (Array.isArray(n.marks) ? n.marks : []).flatMap(m => {
        if (['bold', 'italic', 'code', 'strike'].includes(m.type)) return [{ type: m.type }]
        if (m.type === 'link' && typeof m.attrs?.href === 'string' && /^https?:\/\//.test(m.attrs.href)) {
          try { const u = new URL(m.attrs.href); if (!u.username && !u.password) return [{ type: 'link', attrs: { href: u.href } }] } catch { /* invalid link */ }
        }
        return []
      })
    }
    if (n.type === 'heading') result.attrs = { level: n.attrs?.level === 1 ? 1 : 2 }
    if (n.type === 'orderedList') result.attrs = { start: Number.isInteger(n.attrs?.start) && n.attrs!.start > 0 ? n.attrs!.start : 1 }
    if (n.type === 'image') {
      if (!isNoteImageUrl(n.attrs?.src)) return null
      result.attrs = { src: n.attrs!.src, alt: String(n.attrs?.alt ?? '').slice(0, 200) }
    }
    if (n.type === 'noteAsset') {
      if (!isAssetKind(n.attrs?.kind)) return null
      result.attrs = { kind: n.attrs!.kind, id: typeof n.attrs?.id === 'string' ? n.attrs.id.slice(0, 150) : '' }
    }
    if (n.type === 'noteKeyword') result.attrs = {id:typeof n.attrs?.id === 'string' ? n.attrs.id.slice(0,150) : ''}
    if (n.type === 'noteGift') result.attrs = {id:typeof n.attrs?.id === 'string' ? n.attrs.id.slice(0,150) : '', name:typeof n.attrs?.name === 'string' ? n.attrs.name.slice(0,100) : ''}
    if (n.type === 'noteVideo') result.attrs = { videoId: /^[\w-]{11}$/.test(n.attrs?.videoId ?? '') ? n.attrs!.videoId : '' }
    if (Array.isArray(n.content)) result.content = n.content.flatMap(c => { const clean = node(c, depth + 1); return clean ? [clean] : [] })
    if (['paragraph', 'heading', 'noteTitle'].includes(n.type)) result.content = (result.content ?? []).filter(c => INLINE_TYPES.has(c.type!))
    if (n.type === 'codeBlock') result.content = (result.content ?? []).filter(c => c.type === 'text').map(c => ({type:'text',text:c.text}))
    if (['doc', 'noteBody', 'blockquote', 'listItem'].includes(n.type)) {
      result.content = (result.content ?? []).filter(c => BLOCK_TYPES.has(c.type!))
      if (!result.content.length) result.content = [{type:'paragraph'}]
      if (n.type === 'listItem' && result.content[0].type !== 'paragraph') result.content.unshift({type:'paragraph'})
    }
    if (['bulletList','orderedList'].includes(n.type)) {
      result.content = (result.content ?? []).filter(c => c.type === 'listItem')
      if (!result.content.length) return null
    }
    if (['text','hardBreak','horizontalRule','image','noteAsset','noteVideo','noteKeyword','noteGift'].includes(n.type)) delete result.content
    if (n.type === 'noteAccordion') {
      result.content = [result.content?.find(c => c.type === 'noteTitle') ?? { type: 'noteTitle' }, result.content?.find(c => c.type === 'noteBody') ?? { type: 'noteBody', content: [{ type: 'paragraph' }] }]
    }
    if (n.type === 'noteAsset' && result.attrs?.kind === 'keyword') return {type:'paragraph',content:[{type:'noteKeyword',attrs:{id:result.attrs.id}}]}
    return result
  }
  try { const doc = node(value, 0); return doc?.type === 'doc' ? doc : null } catch { return null }
}
export function parseBlockDocument(value: string): JSONContent | null {
  if (!value.startsWith(NOTE_PREFIX) || value.length > 500_000) return null
  try { return normalizeDocument(JSON.parse(value.slice(NOTE_PREFIX.length))) } catch { return null }
}
export function hasBlocks(node: JSONContent): boolean {
  return node.type?.startsWith('note') === true || (node.content ?? []).some(hasBlocks)
}
export function visibleNode(node: JSONContent): boolean {
  if (node.type === 'noteAsset' || node.type === 'noteKeyword' || node.type === 'noteGift') return Boolean(node.attrs?.id)
  if (node.type === 'noteVideo') return Boolean(node.attrs?.videoId)
  if (node.type === 'image') return isNoteImageUrl(node.attrs?.src)
  return Boolean(node.text?.trim()) || (node.content ?? []).some(visibleNode)
}
export function assetRefs(doc: JSONContent): string {
  const refs = new Map<string, {kind: AssetKind; id: string}>()
  function visit(n: JSONContent) {
    if (n.type === 'noteGift' && n.attrs?.id) refs.set('gift:' + n.attrs.id, {kind: 'gift', id: n.attrs.id})
    if (n.type === 'noteAsset' && isAssetKind(n.attrs?.kind) && n.attrs?.id) refs.set(`${n.attrs.kind}:${n.attrs.id}`, {kind: n.attrs.kind, id: n.attrs.id})
    n.content?.forEach(visit)
  }
  visit(doc)
  return JSON.stringify([...refs.values()].sort((a,b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)))
}
function flattenNote(value: string, gift: (name: string) => string): string {
  const doc = parseBlockDocument(value)
  if (!doc) return value.startsWith(NOTE_PREFIX) ? '' : value
  function text(n: JSONContent): string { return (n.type === 'noteKeyword' ? n.attrs?.id : n.type === 'noteGift' ? (n.attrs?.name ? gift(n.attrs.name) : undefined) : n.text) ?? (n.content ?? []).map(text).join(' ') }
  return text(doc).trim()
}
export function notePlainText(value: string): string {
  return flattenNote(value, name => name)
}
/** One-line card preview: plain text, but gifts stay `[g:name]` tokens so NoteRenderer can draw them with their icon. */
export function notePreviewText(value: string): string {
  return flattenNote(value, name => '[g:' + name + ']')
}
