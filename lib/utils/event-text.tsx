import type { CSSProperties, ReactNode } from 'react'
import { ACTION_EVENT_EFFECTS, AB_EVENT_EFFECTS } from '@/lib/data/event-effects-map'

/** Render only the formatting tags used by the original Unity text. Unknown
 * angle-bracket dialogue stays text; source strings never become HTML. */
export function parseUnityColorTags(raw: string): ReactNode {
  type Frame = { tag: string; style: CSSProperties; children: ReactNode[] }
  const root: Frame = { tag: '', style: {}, children: [] }
  const stack = [root]
  const tokens = raw.replace(/<\/color=[^>]*>/g, '</color>').split(/(<\/?(?:color(?:=#[\da-fA-F]{3,8})?|size(?:=\d+(?:\.\d+)?%?)?|i|b)>)/g)
  let key = 0
  const close = () => {
    const frame = stack.pop()!
    stack[stack.length - 1].children.push(<span key={key++} style={frame.style}>{frame.children}</span>)
  }
  for (const token of tokens) {
    const open = /^<(color|size|i|b)(?:=([^>]+))?>$/.exec(token)
    const closing = /^<\/(color|size|i|b)>$/.exec(token)
    if (open) {
      const [, tag, value] = open
      if ((tag === 'color' || tag === 'size') && !value) { stack[stack.length - 1].children.push(token); continue }
      const style: CSSProperties = tag === 'i' ? { fontStyle: 'italic' }
        : tag === 'b' ? { fontWeight: 700 } : tag === 'color' ? { color: value }
        : Number.parseFloat(value) === 0 ? { display: 'none' }
        : { fontSize: value.endsWith('%') ? value : `${Number(value) / 16}rem` }
      stack.push({ tag, style, children: [] })
    } else if (closing) {
      const index = stack.findLastIndex(frame => frame.tag === closing[1])
      if (index > 0) while (stack.length > index) close()
    } else stack[stack.length - 1].children.push(token)
  }
  while (stack.length > 1) close()
  return root.children
}

export function getOptionEffects(eventId: number, optionIndex: number): ReactNode[] {
  return (ACTION_EVENT_EFFECTS[eventId]?.[optionIndex] ?? []).map(parseUnityColorTags)
}
export function getAbEventEffects(eventId: number): { success: ReactNode[]; failure: ReactNode[] } {
  const data = AB_EVENT_EFFECTS[eventId]
  return { success: (data?.success ?? []).map(parseUnityColorTags), failure: (data?.failure ?? []).map(parseUnityColorTags) }
}
export function replaceEventPlaceholders(text: string | null | undefined, lang: string = 'ko'): string {
  const label = lang === 'en' ? 'Sinner name' : lang === 'ja' ? '囚人名' : '수감자 이름'
  return (text ?? '').replace(/\{\d+\}/g, `{${label}}`)
}
/** Preserve original colors and emphasis instead of guessing from Korean words. */
export function colorizeEventText(text: string | null | undefined, lang: string = 'ko'): ReactNode {
  return text ? parseUnityColorTags(replaceEventPlaceholders(text, lang)) : null
}
