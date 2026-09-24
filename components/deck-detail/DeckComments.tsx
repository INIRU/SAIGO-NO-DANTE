'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Send, X } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import RelativeTime from '@/components/ui/RelativeTime'
import { showSuccess, showError } from '@/lib/toast'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  username: string | null
  avatar_url: string | null
  role?: string
}

type Props = {
  deckId: string
  initialComments: Comment[]
  headingId?: string
}

export default function DeckComments({ deckId, initialComments, headingId }: Props) {
  const t = useTranslations('decks.comments')
  const tCommon = useTranslations('common')
  const { status: authStatus } = useSession()

  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ rootId: string; targetName: string } | null>(null)
  const [replyText, setReplyText] = useState('')

  // Refresh comments when deckId changes (e.g. navigation)
  useEffect(() => {
    setComments(initialComments)
  }, [initialComments])

  const handleCommentSubmit = useCallback(async () => {
    if (!commentText.trim() || commentSubmitting || authStatus !== 'authenticated') return
    setCommentSubmitting(true)
    try {
      const res = await fetch(`/api/decks/${deckId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      if (res.ok) {
        const comment: Comment = await res.json()
        setComments(prev => [...prev, comment])
        setCommentText('')
      } else {
        showError(t('createFailed'))
      }
    } catch {
      showError(t('createFailed'))
    } finally {
      setCommentSubmitting(false)
    }
  }, [commentText, commentSubmitting, authStatus, deckId, t])

  const handleReplySubmit = useCallback(async () => {
    if (!replyingTo || !replyText.trim() || commentSubmitting || authStatus !== 'authenticated') return
    setCommentSubmitting(true)
    try {
      const res = await fetch(`/api/decks/${deckId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText.trim(), parent_id: replyingTo.rootId }),
      })
      if (res.ok) {
        const comment: Comment = await res.json()
        setComments(prev => [...prev, comment])
        setReplyText('')
        setReplyingTo(null)
      } else {
        showError(t('replyFailed'))
      }
    } catch {
      showError(t('replyFailed'))
    } finally {
      setCommentSubmitting(false)
    }
  }, [replyingTo, replyText, commentSubmitting, authStatus, deckId, t])

  const handleCommentDelete = useCallback(async (commentId: string) => {
    try {
      const res = await fetch(`/api/decks/${deckId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
        showSuccess(t('deleteSuccess'))
      } else {
        showError(t('deleteFailed'))
      }
    } catch {
      showError(t('deleteFailed'))
    }
  }, [deckId, t])

  const rootComments = comments.filter(c => !c.parent_id)
  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id)
  const nameOf = (c: Comment) => c.username ?? t('anonymous')
  const signedIn = authStatus === 'authenticated'

  const body = (comment: Comment, small: boolean, onReply: () => void) => (
    <div className="flex gap-3">
      <Image
        src={comment.avatar_url || DEFAULT_AVATAR_URL} alt="" width={small ? 28 : 36} height={small ? 28 : 36}
        className={`${small ? 'h-7 w-7' : 'h-9 w-9'} shrink-0 rounded-full bg-[#17120c] object-cover`}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[0.9375rem] font-semibold text-[#e8dcc8]">{nameOf(comment)}</span>
          {comment.role === 'admin' && <span className="text-[0.75rem] font-semibold text-[#e48b7f]">Admin</span>}
          {comment.role === 'wanjang' && <span className="text-[0.75rem] font-semibold text-[#e8b030]">{t('moderator')}</span>}
          <RelativeTime date={comment.created_at} className="text-[0.8125rem] text-[#7f7364]" />
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-[#cfc2ad]">{comment.content}</p>
        {signedIn && (
          <div className="mt-1 flex items-center gap-1">
            <button type="button" onClick={onReply} className="-ml-1 inline-flex min-h-9 items-center rounded px-1 text-[0.8125rem] text-[#9c8b73] hover:text-[#e8b030]">
              {t('reply')}
            </button>
            <button
              type="button"
              onClick={() => handleCommentDelete(comment.id)}
              className="inline-flex min-h-9 items-center rounded px-1 text-[0.8125rem] text-[#7f7364] hover:text-[#e48b7f]"
            >
              {small ? t('deleteReply') : t('deleteComment')}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <h2 id={headingId} className="mb-5 flex items-baseline gap-2.5 font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[#e8dcc8] sm:text-[1.5rem]">
        {t('title')}
        <span className="font-[family-name:var(--font-body)] text-[1rem] tabular-nums text-[#9c8b73]">{comments.length}</span>
      </h2>

      {signedIn ? (
        <form onSubmit={event => { event.preventDefault(); handleCommentSubmit() }} className="max-w-[52rem]">
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            aria-label={t('placeholder')}
            placeholder={t('placeholder')}
            maxLength={500}
            rows={3}
            className="block w-full resize-y rounded-md border border-[#2e2417] bg-[#17120c] px-3.5 py-3 text-[0.9375rem] leading-relaxed text-[#e8dcc8] placeholder:text-[#7f7364] transition-colors focus:border-[#c8900a] focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCommentSubmit() }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[0.8125rem] tabular-nums text-[#7f7364]">{commentText.length}/500</span>
            <button
              type="submit"
              disabled={commentSubmitting || !commentText.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded border border-[#8a6010] bg-[#2a1f0c] px-4 text-[0.9375rem] font-semibold text-[#e8b030] transition-colors hover:border-[#c8900a] hover:bg-[#35270e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {commentSubmitting ? t('submitting') : t('submit')}
            </button>
          </div>
        </form>
      ) : (
        <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem]">
          <Link href="/login" className="text-[#e8b030] underline-offset-4 hover:underline">{t('loginRequired')}</Link>
        </p>
      )}

      {rootComments.length === 0 ? (
        <p className="mt-6 text-[0.9375rem] text-[#7f7364]">{t('empty')}</p>
      ) : (
        <ol className="mt-6 max-w-[52rem] divide-y divide-[#241c14] border-t border-[#241c14]">
          {rootComments.map(comment => {
            const replies = repliesOf(comment.id)
            const replying = replyingTo?.rootId === comment.id
            return (
              <li key={comment.id} className="py-4">
                {body(comment, false, () => {
                  setReplyingTo(replying ? null : { rootId: comment.id, targetName: nameOf(comment) })
                  setReplyText('')
                })}
                {(replies.length > 0 || replying) && (
                  <ol className="ml-[3rem] mt-3 space-y-4 border-l border-[#2e2417] pl-4">
                    {replies.map(reply => (
                      <li key={reply.id}>
                        {body(reply, true, () => {
                          setReplyingTo({ rootId: comment.id, targetName: nameOf(reply) })
                          setReplyText(`@${nameOf(reply)} `)
                        })}
                      </li>
                    ))}
                    {replying && replyingTo && (
                      <li>
                        <form onSubmit={event => { event.preventDefault(); handleReplySubmit() }}>
                          <div className="mb-2 flex items-center justify-between gap-3 rounded border border-[#3a2c14] bg-[#17120c] py-1 pl-3 pr-1 text-[0.875rem] text-[#e8b030]">
                            <span className="min-w-0 truncate">@{replyingTo.targetName}{t('replyingToSuffix')}</span>
                            <button
                              type="button"
                              onClick={() => setReplyingTo(null)}
                              aria-label={tCommon('cancel')}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-[#9c8b73] hover:text-[#e8dcc8]"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                          <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            aria-label={t('replyPlaceholder')}
                            placeholder={t('replyPlaceholder')}
                            maxLength={500}
                            rows={2}
                            autoFocus
                            className="block w-full resize-y rounded-md border border-[#2e2417] bg-[#17120c] px-3 py-2.5 text-[0.9375rem] leading-relaxed text-[#e8dcc8] placeholder:text-[#7f7364] focus:border-[#c8900a] focus:outline-none"
                          />
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-[0.8125rem] tabular-nums text-[#7f7364]">{replyText.length}/500</span>
                            <button
                              type="submit"
                              disabled={commentSubmitting || !replyText.trim()}
                              className="inline-flex min-h-10 items-center gap-2 rounded border border-[#8a6010] bg-[#2a1f0c] px-3.5 text-[0.875rem] font-semibold text-[#e8b030] transition-colors hover:border-[#c8900a] hover:bg-[#35270e] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {commentSubmitting ? t('submitting') : t('replySubmit')}
                            </button>
                          </div>
                        </form>
                      </li>
                    )}
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
