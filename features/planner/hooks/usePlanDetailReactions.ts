'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { showError, showSuccess } from '@/lib/toast'

/** The plan detail page's view count (once per plan and browser session), the vote and the share button. */
export function usePlanDetailReactions({ planId, planTitle, initialVoteCount, session }: { planId: string; planTitle: string; initialVoteCount: number; session: unknown }) {
  const tDetail = useTranslations('planner.detail')
  const tShare = useTranslations('decks.detail')
  const [voted, setVoted] = useState(false)
  const [voteCount, setVoteCount] = useState(initialVoteCount)
  const [voteLoading, setVoteLoading] = useState(false)

  // 조회수 증가 (플랜당 브라우저 세션에 1회)
  useEffect(() => {
    const key = `plan-viewed:${planId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* 저장소를 못 쓰면 매번 센다 */ }
    fetch(`/api/planner/${planId}/view`, { method: 'POST' }).catch(() => {})
  }, [planId])

  // 추천 상태 확인
  useEffect(() => {
    if (!session) return
    fetch(`/api/planner/${planId}/vote`)
      .then(r => r.json())
      .then(d => setVoted(d.voted ?? false))
      .catch(() => {})
  }, [planId, session])

  const handleVote = async () => {
    if (!session) { showError(tDetail('loginRequired')); return }
    setVoteLoading(true)
    try {
      const res = await fetch(`/api/planner/${planId}/vote`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setVoted(json.voted)
        setVoteCount(prev => json.voted ? prev + 1 : prev - 1)
      } else {
        showError(tDetail('voteFailed'))
      }
    } catch { showError(tDetail('voteFailed')) } finally {
      setVoteLoading(false)
    }
  }

  const handleShare = async () => {
    const url = window.location.href.split('#')[0]
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: planTitle, url })
        return
      }
      await navigator.clipboard.writeText(url)
      showSuccess(tShare('shareCopied'))
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') showError(tDetail('shareFailed'))
    }
  }

  return { voted, voteCount, voteLoading, handleVote, handleShare }
}
