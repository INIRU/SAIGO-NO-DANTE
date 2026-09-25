'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { Languages } from 'lucide-react'
import { applyTranslations, textLanguage, uniqueSegments, type TranslateLang } from '@/lib/translate/segments'
import { showError } from '@/lib/toast'

type Kind = 'deck' | 'plan'
type Pairs = [string, string][]
type Ctx = { translated: (text: string) => string; on: boolean; working: boolean; toggle: () => void; needed: boolean }

const PostTranslationContext = createContext<Ctx | null>(null)

const COPY = {
  ko: { translate: '번역 보기', original: '원문 보기', working: '번역 중…', failed: '번역하지 못했습니다' },
  en: { translate: 'Translate', original: 'Show original', working: 'Translating…', failed: 'Could not translate' },
  ja: { translate: '翻訳を表示', original: '原文を表示', working: '翻訳中…', failed: '翻訳できませんでした' },
} as const

/**
 * Shows a deck's or plan's own texts in the reader's language. Translations are made on the server when the post is
 * saved (lib/translate/server.ts) and passed in as `initial`, shown by default; older posts are translated on request.
 */
export function PostTranslationProvider({ kind, id, texts, initial, children }: {
  kind: Kind; id: string; texts: (string | null | undefined)[]; initial?: Pairs | null; children: ReactNode
}) {
  const target = useLocale() as TranslateLang
  const needed = useMemo(() => { const source = textLanguage(uniqueSegments(texts).join('\n')); return source !== null && source !== target }, [texts, target])
  const [pairs, setPairs] = useState<Map<string, string> | null>(() => initial?.length ? new Map(initial) : null)
  const [on, setOn] = useState(Boolean(initial?.length))
  const [working, setWorking] = useState(false)

  const toggle = useCallback(async () => {
    if (working) return
    if (on || pairs) { setOn(!on); return }
    setWorking(true)
    try {
      const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, target }) })
      if (!res.ok) throw new Error(String(res.status))
      setPairs(new Map((await res.json() as { pairs: Pairs }).pairs))
      setOn(true)
    } catch {
      showError((COPY[target] ?? COPY.en).failed)
    } finally {
      setWorking(false)
    }
  }, [working, on, pairs, kind, id, target])

  const value = useMemo<Ctx>(() => ({
    translated: text => on && pairs ? applyTranslations(text, pairs) : text,
    on, working, toggle, needed,
  }), [on, working, pairs, toggle, needed])
  return <PostTranslationContext.Provider value={value}>{children}</PostTranslationContext.Provider>
}

/** The text in the reader's language while translation is on (outside a provider it returns the text as is). */
export function useTranslatedText(text: string) {
  return useContext(PostTranslationContext)?.translated(text) ?? text
}

const identity = (text: string) => text
/** The translate function itself, for texts built in loops. */
export function usePostTranslator(): (text: string) => string {
  return useContext(PostTranslationContext)?.translated ?? identity
}

export function TranslatedText({ text }: { text: string }) {
  return <>{useTranslatedText(text)}</>
}

/** Shown only when the post is written in another language than the page. */
export function TranslateButton({ className }: { className?: string }) {
  const ctx = useContext(PostTranslationContext)
  const locale = useLocale()
  if (!ctx?.needed) return null
  const copy = COPY[locale as TranslateLang] ?? COPY.en
  return (
    <button type="button" className={className} onClick={ctx.toggle} aria-pressed={ctx.on} disabled={ctx.working}>
      <Languages className="h-4 w-4" aria-hidden="true" />
      {ctx.working ? copy.working : ctx.on ? copy.original : copy.translate}
    </button>
  )
}
