'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import Image from 'next/image'
import { Link } from '@/lib/i18n/navigation'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Send, X } from 'lucide-react'
import RelativeTime from '@/components/ui/RelativeTime'
import { showError } from '@/lib/toast'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

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

function CommentBody({ comment, name, small, action }: { comment: Comment; name: string; small?: boolean; action?: React.ReactNode }) {
  const size = small ? 28 : 36
  return (
    <div className="flex gap-3">
      <Image
        src={comment.profiles?.avatar_url ?? DEFAULT_AVATAR_URL} alt="" width={size} height={size}
        className={`${small ? 'h-7 w-7' : 'h-9 w-9'} shrink-0 rounded-full bg-[#17120c] object-cover`}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[0.9375rem] font-semibold text-[#e8dcc8]">{name}</span>
          <RelativeTime date={comment.created_at} className="text-[0.8125rem] text-[#7f7364]" />
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-[#cfc2ad]">{comment.content}</p>
        {action}
      </div>
    </div>
  )
}

export default function PlanComments({ planId, headingId }: Props) {
  const t = useTranslations('decks.comments')
  const tDetail = useTranslations('planner.detail')
  const tGrid = useTranslations('decks.grid')
  const tCommon = useTranslations('common')
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null)

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

  const handleCommentSubmit = async () => {
    if (!session) { showError(t('loginRequired')); return }
    const content = commentText.trim()
    if (!content) return
    setSubmitting(true)
    try {
      const body: Record<string, string> = { content }
      if (replyTo) body.parent_id = replyTo.id
      const res = await fetch(`/api/planner/${planId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setCommentText('')
        setReplyTo(null)
        fetchComments()
      } else {
        showError(replyTo ? t('replyFailed') : t('createFailed'))
      }
    } catch {
      showError(replyTo ? t('replyFailed') : t('createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    handleCommentSubmit()
  }

  const topLevel = comments.filter(c => !c.parent_id)
  const nameOf = (c: Comment) => c.profiles?.username ?? t('anonymous')

  return (
    <div>
      <h2 id={headingId} className="mb-5 flex items-baseline gap-2.5 font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[#e8dcc8] sm:text-[1.5rem]">
        {t('title')}
        <span className="font-[family-name:var(--font-body)] text-[1rem] tabular-nums text-[#9c8b73]">{comments.length}</span>
      </h2>

      {session ? (
        <form onSubmit={onSubmit} className="max-w-[52rem]">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded border border-[#3a2c14] bg-[#17120c] py-1 pl-3 pr-1 text-[0.875rem] text-[#e8b030]">
              <span className="min-w-0 truncate">@{replyTo.username}{t('replyingToSuffix')}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={tCommon('cancel')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-[#9c8b73] hover:text-[#e8dcc8]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            aria-label={replyTo ? t('replyPlaceholder') : tDetail('commentPlaceholder')}
            placeholder={replyTo ? t('replyPlaceholder') : tDetail('commentPlaceholder')}
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
              {submitting ? t('submitting') : replyTo ? t('replySubmit') : t('submit')}
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
      ) : topLevel.length === 0 ? (
        <p className="mt-6 text-[0.9375rem] text-[#7f7364]">{t('empty')}</p>
      ) : (
        <ol className="mt-6 max-w-[52rem] divide-y divide-[#241c14] border-t border-[#241c14]">
          {topLevel.map(comment => {
            const replies = comments.filter(c => c.parent_id === comment.id)
            return (
              <li key={comment.id} className="py-4">
                <CommentBody
                  comment={comment}
                  name={nameOf(comment)}
                  action={session && (
                    <button
                      type="button"
                      onClick={() => setReplyTo({ id: comment.id, username: nameOf(comment) })}
                      className="-ml-1 mt-1 inline-flex min-h-9 items-center rounded px-1 text-[0.8125rem] text-[#9c8b73] hover:text-[#e8b030]"
                    >
                      {t('reply')}
                    </button>
                  )}
                />
                {replies.length > 0 && (
                  <ol className="ml-[3rem] mt-3 space-y-4 border-l border-[#2e2417] pl-4">
                    {replies.map(reply => (
                      <li key={reply.id}><CommentBody comment={reply} name={nameOf(reply)} small /></li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
