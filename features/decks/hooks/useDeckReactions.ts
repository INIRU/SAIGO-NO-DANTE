'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { showError, showSuccess } from '@/lib/toast'

/** A deck's vote and bookmark state for the signed-in viewer, and the buttons that toggle them. */
export function useDeckReactions({ id, authStatus, initialVoteCount }: { id: string; authStatus: string; initialVoteCount: number }) {
  const router = useRouter()
  const t = useTranslations('decks.detail')
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(initialVoteCount)
  const [voting, setVoting] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarking, setBookmarking] = useState(false)

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    fetch(`/api/decks/${id}/vote`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setVoted(data.voted) })
      .catch(() => {})
  }, [id, authStatus])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    fetch(`/api/decks/${id}/bookmark`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBookmarked(data.bookmarked) })
      .catch(() => {})
  }, [id, authStatus])

  const handleVote = useCallback(async () => {
    if (authStatus !== 'authenticated' || voting) return
    setVoting(true)
    try {
      const res = await fetch(`/api/decks/${id}/vote`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setVoted(data.voted)
        setVoteCount(c => data.voted ? c + 1 : Math.max(0, c - 1))
        router.refresh()
      } else {
        showError(t('voteFailed'))
      }
    } catch {
      showError(t('voteFailed'))
    } finally {
      setVoting(false)
    }
  }, [authStatus, id, router, voting, t])

  const handleBookmark = useCallback(async () => {
    if (authStatus !== 'authenticated' || bookmarking) return
    setBookmarking(true)
    try {
      const res = await fetch(`/api/decks/${id}/bookmark`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setBookmarked(data.bookmarked)
        showSuccess(data.bookmarked ? t('bookmarkAdded') : t('bookmarkRemoved'))
        router.refresh()
      } else {
        showError(t('bookmarkFailed'))
      }
    } catch {
      showError(t('bookmarkFailed'))
    } finally {
      setBookmarking(false)
    }
  }, [authStatus, id, bookmarking, router, t])

  return { voted, voteCount, setVoteCount, voting, handleVote, bookmarked, bookmarking, handleBookmark }
}
