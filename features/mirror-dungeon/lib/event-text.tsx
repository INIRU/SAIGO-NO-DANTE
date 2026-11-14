import type { CSSProperties, ReactNode } from 'react'
import PlaceholderLabel from '@/components/ui/PlaceholderLabel'
import { splitPlaceholders } from '@/lib/game-text/placeholders'

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
    } else {
      // {{sinner}} and the other placeholder tokens become labels; plain text stays text.
      for (const part of splitPlaceholders(token)) {
        stack[stack.length - 1].children.push(typeof part === 'string' ? part : <PlaceholderLabel key={key++} {...part} />)
      }
    }
  }
  while (stack.length > 1) close()
  return root.children
}

/** Event text from before the sync stored {{sinner}} (a bare {0}) reads the same as the token. */
export function replaceEventPlaceholders(text: string | null | undefined): string {
  return (text ?? '').replace(/\{\d+\}/g, '{{sinner}}')
}
/**
 * Preserve original colors and emphasis instead of guessing from Korean words. Placeholder labels take their wording
 * from the page's messages, so `_lang` is only kept for existing callers.
 */
export function colorizeEventText(text: string | null | undefined, _lang?: string): ReactNode {
  return text ? parseUnityColorTags(replaceEventPlaceholders(text)) : null
}
