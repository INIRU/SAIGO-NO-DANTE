'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { Languages } from 'lucide-react'
import { applyTranslations, textLanguage, uniqueSegments, type TranslateLang } from '@/lib/translate/segments'
import { showError } from '@/lib/toast'

type Kind = 'deck' | 'plan'
type State = 'idle' | 'working' | 'on'
type Ctx = { translated: (text: string) => string; state: State; toggle: () => void; needed: boolean }

const PostTranslationContext = createContext<Ctx | null>(null)

const COPY = {
  ko: { translate: '번역', original: '원문 보기', working: '번역 중…', failed: '번역하지 못했습니다' },
  en: { translate: 'Translate', original: 'Show original', working: 'Translating…', failed: 'Could not translate' },
  ja: { translate: '翻訳', original: '原文を表示', working: '翻訳中…', failed: '翻訳できませんでした' },
} as const

type BrowserTranslator = { translate: (text: string) => Promise<string>; destroy?: () => void }
type TranslatorApi = {
  availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>
  create: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<BrowserTranslator>
}

/** Chrome's on-device translator (free); null where the browser has none or lacks the language pair. */
async function browserTranslate(segments: string[], source: TranslateLang, target: TranslateLang) {
  const api = (globalThis as { Translator?: TranslatorApi }).Translator
  if (!api) return null
  try {
    if (await api.availability({ sourceLanguage: source, targetLanguage: target }) === 'unavailable') return null
    const translator = await api.create({ sourceLanguage: source, targetLanguage: target })
    const out = await Promise.all(segments.map(segment => translator.translate(segment)))
    translator.destroy?.()
    return segments.map((segment, index) => [segment, out[index]] as [string, string])
  } catch {
    return null
  }
}

async function serverTranslate(kind: Kind, id: string, target: TranslateLang) {
  const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, target }) })
  if (!res.ok) throw new Error(String(res.status))
  return (await res.json() as { pairs: [string, string][] }).pairs
}

/**
 * Wraps a deck or plan so its title, notes and memos can be shown in the reader's language.
 * The browser translator is tried first; otherwise the server translates once and caches per post.
 */
export function PostTranslationProvider({ kind, id, texts, children }: { kind: Kind; id: string; texts: (string | null | undefined)[]; children: ReactNode }) {
  const target = useLocale() as TranslateLang
  const segments = useMemo(() => uniqueSegments(texts), [texts])
  const source = useMemo(() => textLanguage(segments.join('\n')), [segments])
  const needed = source !== null && source !== target
  const [pairs, setPairs] = useState<Map<string, string> | null>(null)
  const [state, setState] = useState<State>('idle')

  const toggle = useCallback(async () => {
    if (state === 'working') return
    if (state === 'on') { setState('idle'); return }
    if (pairs) { setState('on'); return }
    setState('working')
    try {
      const found = (source && await browserTranslate(segments, source, target)) ?? await serverTranslate(kind, id, target)
      setPairs(new Map(found))
      setState('on')
    } catch {
      showError(COPY[target]?.failed ?? COPY.en.failed)
      setState('idle')
    }
  }, [state, pairs, source, segments, target, kind, id])

  const value = useMemo<Ctx>(() => ({
    translated: text => state === 'on' && pairs ? applyTranslations(text, pairs) : text,
    state, toggle, needed,
  }), [state, pairs, toggle, needed])
  return <PostTranslationContext.Provider value={value}>{children}</PostTranslationContext.Provider>
}

/** The text in the reader's language while translation is on (outside a provider it returns the text as is). */
export function useTranslatedText(text: string) {
  return useContext(PostTranslationContext)?.translated(text) ?? text
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
    <button type="button" className={className} onClick={ctx.toggle} aria-pressed={ctx.state === 'on'} disabled={ctx.state === 'working'}>
      <Languages className="h-4 w-4" aria-hidden="true" />
      {ctx.state === 'working' ? copy.working : ctx.state === 'on' ? copy.original : copy.translate}
    </button>
  )
}
