'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'
import { showError } from '@/lib/toast'
import CommentThread, { CommentReplyForm, type ThreadItem } from '@/components/comments/CommentThread'

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  profiles: { username: string | null; avatar_url: string | null } | null
}

interface Props {
  planId: string
  headingId?: string
}

export default function PlanComments({ planId, headingId }: Props) {
  const t = useTranslations('decks.comments')
  const tDetail = useTranslations('planner.detail')
  const tGrid = useTranslations('decks.grid')
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)
  const [replyText, setReplyText] = useState('')

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/planner/${planId}/comments`)
      if (!res.ok) return
      const json = await res.json()
      setComments(json.comments ?? [])
    } catch {
      /* 무시 */
    } finally {
      setCommentsLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const post = async (content: string, parentId: string | null) => {
    if (!session) { showError(t('loginRequired')); return false }
    if (!content.trim()) return false
    setSubmitting(true)
    try {
      const res = await fetch(`/api/planner/${planId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parentId ? { content: content.trim(), parent_id: parentId } : { content: content.trim() }),
      })
      if (!res.ok) { showError(parentId ? t('replyFailed') : t('createFailed')); return false }
      fetchComments()
      return true
    } catch {
      showError(parentId ? t('replyFailed') : t('createFailed'))
      return false
    } finally {
      setSubmitting(false)
    }
  }
  const handleCommentSubmit = async () => { if (await post(commentText, null)) setCommentText('') }
  const handleReplySubmit = async () => { if (replyTo && await post(replyText, replyTo.id)) { setReplyText(''); setReplyTo(null) } }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    handleCommentSubmit()
  }

  const items: ThreadItem[] = comments.map(c => ({ ...c, name: c.profiles?.username ?? t('anonymous'), avatar: c.profiles?.avatar_url ?? null }))

  return (
    <div>
      <h2 id={headingId} className="mb-5 flex items-baseline gap-2.5 font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[#e8dcc8] sm:text-[1.5rem]">
        {t('title')}
        <span className="font-[family-name:var(--font-body)] text-[1rem] tabular-nums text-[#9c8b73]">{comments.length}</span>
      </h2>

      {session ? (
        <form onSubmit={onSubmit} className="max-w-[52rem]">
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            aria-label={tDetail('commentPlaceholder')}
            placeholder={tDetail('commentPlaceholder')}
            maxLength={500}
            rows={3}
            className="block w-full resize-y rounded-md border border-[#2e2417] bg-[#17120c] px-3.5 py-3 text-[0.9375rem] leading-relaxed text-[#e8dcc8] placeholder:text-[#7f7364] transition-colors focus:border-[#c8900a] focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleCommentSubmit()
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[0.8125rem] tabular-nums text-[#7f7364]">{commentText.length}/500</span>
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded border border-[#8a6010] bg-[#2a1f0c] px-4 text-[0.9375rem] font-semibold text-[#e8b030] transition-colors hover:border-[#c8900a] hover:bg-[#35270e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {submitting ? t('submitting') : t('submit')}
            </button>
          </div>
        </form>
      ) : (
        <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem]">
          <Link href="/login" className="text-[#e8b030] underline-offset-4 hover:underline">{t('loginRequired')}</Link>
        </p>
      )}

      {commentsLoading ? (
        <p className="mt-6 text-[0.9375rem] text-[#7f7364]" role="status">{tGrid('loadingMore')}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-[0.9375rem] text-[#7f7364]">{t('empty')}</p>
      ) : (
        <CommentThread
          items={items}
          canReply={Boolean(session)}
          replyingTo={replyTo?.id ?? null}
          onReply={item => { setReplyTo(replyTo?.id === item.id ? null : { id: item.id, username: item.name }); setReplyText('') }}
          replyForm={replyTo && (
            <CommentReplyForm targetName={replyTo.username} value={replyText} onChange={setReplyText} onSubmit={handleReplySubmit} onCancel={() => setReplyTo(null)} submitting={submitting} />
          )}
        />
      )}
    </div>
  )
}
