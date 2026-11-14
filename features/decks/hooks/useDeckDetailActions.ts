'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { showError } from '@/lib/toast'
import type { SupportedLang } from '@/lib/i18n/types'

/** The deck page's copy-code, share and fork buttons, with the "done" marks they show for two seconds. */
export function useDeckDetailActions({ id, locale, deck }: { id: string; locale: SupportedLang; deck: { title: string; deck_code?: string } | null }) {
  const router = useRouter()
  const rootT = useTranslations()
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [shareGenerating, setShareGenerating] = useState(false)

  const handleCopyCode = useCallback(async () => {
    if (!deck?.deck_code) return
    try {
      await navigator.clipboard.writeText(deck.deck_code)
    } catch {
      showError(rootT('planner.detail.copyDeckCodeFailed'))
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [deck?.deck_code, rootT])

  const handleShare = useCallback(async () => {
    if (shareGenerating || !deck) return
    setShareGenerating(true)
    try {
      const shareUrl = `${window.location.origin}/${locale}/decks/${id}`
      if (navigator.share) {
        try {
          await navigator.share({ url: shareUrl, title: deck.title })
        } catch (e) {
          if (e instanceof Error && e.name !== 'AbortError') throw e
        }
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {
      showError(rootT('planner.detail.shareFailed'))
    } finally {
      setShareGenerating(false)
    }
  }, [shareGenerating, deck, id, locale, rootT])

  const handleFork = useCallback(() => {
    router.push(`/decks/new?fork=${id}`, { locale })
  }, [id, locale, router])

  return { copied, shared, shareGenerating, handleCopyCode, handleShare, handleFork }
}
