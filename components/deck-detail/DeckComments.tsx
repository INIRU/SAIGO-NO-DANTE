'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { showSuccess, showError } from '@/lib/toast'
import { descendantIds } from '@/lib/comments/thread'
import CommentThread, { CommentReplyForm, type ThreadItem } from '@/components/comments/CommentThread'

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
  const { status: authStatus } = useSession()

  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ parentId: string; targetName: string } | null>(null)
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
        body: JSON.stringify({ content: replyText.trim(), parent_id: replyingTo.parentId }),
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
        setComments(prev => { const gone = descendantIds(prev, commentId); return prev.filter(c => c.id !== commentId && !gone.has(c.id)) })
        showSuccess(t('deleteSuccess'))
      } else {
        showError(t('deleteFailed'))
      }
    } catch {
      showError(t('deleteFailed'))
    }
  }, [deckId, t])

  const signedIn = authStatus === 'authenticated'
  const items: ThreadItem[] = comments.map(c => ({
    ...c, name: c.username ?? t('anonymous'), avatar: c.avatar_url,
    badge: c.role === 'admin' ? <span className="text-[0.75rem] font-semibold text-[#e48b7f]">Admin</span>
      : c.role === 'wanjang' ? <span className="text-[0.75rem] font-semibold text-[var(--gold-light)]">{t('moderator')}</span> : undefined,
  }))

  return (
    <div>
      <h2 id={headingId} className="mb-5 flex items-baseline gap-2.5 font-[family-name:var(--font-heading)] text-[1.375rem] leading-snug text-[var(--text-primary)] sm:text-[1.5rem]">
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
            className="block w-full resize-y rounded-md border border-[#2e2417] bg-[#17120c] px-3.5 py-3 text-[0.9375rem] leading-relaxed text-[var(--text-primary)] placeholder:text-[#7f7364] transition-colors focus:border-[var(--gold)] focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCommentSubmit() }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[0.8125rem] tabular-nums text-[#7f7364]">{commentText.length}/500</span>
            <button
              type="submit"
              disabled={commentSubmitting || !commentText.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded border border-[var(--gold-dim)] bg-[#2a1f0c] px-4 text-[0.9375rem] font-semibold text-[var(--gold-light)] transition-colors hover:border-[var(--gold)] hover:bg-[#35270e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {commentSubmitting ? t('submitting') : t('submit')}
            </button>
          </div>
        </form>
      ) : (
        <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem]">
          <Link href="/login" className="text-[var(--gold-light)] underline-offset-4 hover:underline">{t('loginRequired')}</Link>
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-[0.9375rem] text-[#7f7364]">{t('empty')}</p>
      ) : (
        <CommentThread
          items={items}
          canReply={signedIn}
          replyingTo={replyingTo?.parentId ?? null}
          onReply={item => { setReplyingTo(replyingTo?.parentId === item.id ? null : { parentId: item.id, targetName: item.name }); setReplyText('') }}
          replyForm={replyingTo && (
            <CommentReplyForm targetName={replyingTo.targetName} value={replyText} onChange={setReplyText} onSubmit={handleReplySubmit} onCancel={() => setReplyingTo(null)} submitting={commentSubmitting} />
          )}
          actions={signedIn ? (item, isReply) => (
            <button type="button" onClick={() => handleCommentDelete(item.id)} className="inline-flex min-h-9 items-center rounded px-1 text-[0.8125rem] text-[#7f7364] hover:text-[#e48b7f]">
              {isReply ? t('deleteReply') : t('deleteComment')}
            </button>
          ) : undefined}
        />
      )}
    </div>
  )
}
