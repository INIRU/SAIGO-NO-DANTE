'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Trash2, Reply, X } from 'lucide-react'
import { showSuccess, showError } from '@/lib/toast'
import { DEFAULT_AVATAR_URL } from '@/lib/constants/game'
import SectionBlock from '@/components/ui/SectionBlock'

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
}

export default function DeckComments({ deckId, initialComments }: Props) {
  const t = useTranslations('decks.comments')
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

  const renderAvatar = (comment: Comment, size: number) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(58,40,18,0.5)',
        flexShrink: 0,
      }}
    >
      <Image
        src={comment.avatar_url || DEFAULT_AVATAR_URL}
        alt=""
        fill
        sizes={`${size}px`}
        style={{ objectFit: 'cover' }}
      />
    </div>
  )

  const renderBadge = (role?: string) => (
    <>
      {role === 'admin' && (
        <span
          style={{
            fontSize: '0.5625rem',
            fontFamily: 'var(--font-mono)',
            color: '#e84040',
            background: 'rgba(232,64,64,0.12)',
            border: '1px solid rgba(232,64,64,0.3)',
            borderRadius: '3px',
            padding: '1px 5px',
            letterSpacing: '0.05em',
          }}
        >
          ADMIN
        </span>
      )}
      {role === 'wanjang' && (
        <span
          style={{
            fontSize: '0.5625rem',
            fontFamily: 'var(--font-mono)',
            color: '#e89040',
            background: 'rgba(232,144,64,0.12)',
            border: '1px solid rgba(232,144,64,0.3)',
            borderRadius: '3px',
            padding: '1px 5px',
            letterSpacing: '0.05em',
          }}
        >
          {t('moderator')}
        </span>
      )}
    </>
  )

  const formatDate = (d: string) =>
    d.slice(5, 7) + '.' + d.slice(8, 10) + ' ' + d.slice(11, 16)

  const rootComments = comments.filter(c => !c.parent_id)
  const repliesMap = new Map<string, Comment[]>()
  for (const c of comments) {
    if (c.parent_id) {
      const arr = repliesMap.get(c.parent_id) ?? []
      arr.push(c)
      repliesMap.set(c.parent_id, arr)
    }
  }

  return (
    <div className="mt-8">
      <SectionBlock title={t('title')} badge={comments.length} defaultOpen={true}>

        {authStatus === 'authenticated' ? (
          <div
            className="rounded-lg p-4 mb-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('placeholder')}
              className="w-full px-3 py-2 outline-none resize-none"
              style={{
                background: 'var(--bg-deep)',
                border: '1px solid var(--border)',
                borderRadius: '0.25rem',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span
                style={{
                  color: 'var(--text-tertiary)',
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {commentText.length}/500
              </span>
              <button
                onClick={handleCommentSubmit}
                disabled={commentSubmitting || !commentText.trim()}
                className="px-4 py-1.5 text-xs font-medium transition-all duration-150 hover:brightness-110"
                style={{
                  background: commentText.trim() ? 'var(--gold)' : 'rgba(44,28,12,0.5)',
                  color: commentText.trim() ? 'var(--bg-deep)' : '#5a5070',
                  borderRadius: '4px',
                  cursor: commentText.trim() ? 'pointer' : 'default',
                  fontFamily: 'var(--font-heading)',
                  opacity: commentSubmitting ? 0.5 : 1,
                }}
              >
                {commentSubmitting ? t('submitting') : t('submit')}
              </button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-lg px-4 py-3 mb-4 text-center"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {t('loginRequired')}
          </div>
        )}

        {rootComments.length > 0 ? (
          <div className="flex flex-col gap-3">
            {rootComments.map(comment => {
              const replies = repliesMap.get(comment.id) ?? []
              const hasReplies = replies.length > 0 || replyingTo?.rootId === comment.id
              return (
                <div key={comment.id}>
                  {/* 루트 댓글 */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start gap-3">
                      {renderAvatar(comment, 28)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ color: '#9a8a70', fontSize: '0.75rem', fontWeight: 600 }}>
                            {comment.username ?? t('anonymous')}
                          </span>
                          {renderBadge(comment.role)}
                          <span
                            style={{
                              color: '#5a5065',
                              fontSize: '0.625rem',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <p
                          style={{
                            color: '#7a7060',
                            fontSize: '0.8125rem',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          {authStatus === 'authenticated' && (
                            <button
                              onClick={() => {
                                setReplyingTo(prev =>
                                  prev?.rootId === comment.id &&
                                  prev?.targetName === (comment.username ?? t('anonymous'))
                                    ? null
                                    : { rootId: comment.id, targetName: comment.username ?? t('anonymous') }
                                )
                                setReplyText('')
                              }}
                              className="flex items-center gap-1 transition-colors hover:text-yellow-600"
                              style={{
                                color:
                                  replyingTo?.rootId === comment.id
                                    ? 'var(--gold-dim)'
                                    : '#4a4055',
                                fontSize: '0.6875rem',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-body)',
                              }}
                            >
                              <Reply size={11} />
                              {replies.length > 0 ? t('replyCount', { count: replies.length }) : t('reply')}
                            </button>
                          )}
                          {authStatus !== 'authenticated' && replies.length > 0 && (
                            <span
                              className="flex items-center gap-1"
                              style={{
                                color: '#4a4055',
                                fontSize: '0.6875rem',
                                fontFamily: 'var(--font-body)',
                              }}
                            >
                              <Reply size={11} />
                              {t('replyCount', { count: replies.length })}
                            </span>
                          )}
                        </div>
                      </div>
                      {authStatus === 'authenticated' && (
                        <button
                          onClick={() => handleCommentDelete(comment.id)}
                          className="flex-shrink-0 p-1 rounded transition-opacity hover:opacity-70"
                          style={{ color: '#3a2020', cursor: 'pointer' }}
                          title={t('deleteComment')}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 답글 영역 */}
                  {hasReplies && (
                    <div
                      className="mt-1 rounded-lg"
                      style={{
                        background: '#0e0b07',
                        border: '1px solid rgba(58,40,18,0.25)',
                        overflow: 'hidden',
                        marginLeft: 16,
                      }}
                    >
                      {replies.map((reply, ri) => (
                        <div
                          key={reply.id}
                          className="flex items-start gap-2.5 px-4 py-3"
                          style={{
                            marginLeft: 0,
                            borderLeft: '2px solid rgba(200,144,10,0.1)',
                            ...(ri < replies.length - 1
                              ? { borderBottom: '1px solid rgba(58,40,18,0.15)' }
                              : {}),
                          }}
                        >
                          {renderAvatar(reply, 22)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                style={{
                                  color: '#8a7a60',
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                }}
                              >
                                {reply.username ?? t('anonymous')}
                              </span>
                              {renderBadge(reply.role)}
                              <span
                                style={{
                                  color: '#4a4555',
                                  fontSize: '0.5625rem',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {formatDate(reply.created_at)}
                              </span>
                            </div>
                            <p
                              style={{
                                color: '#6a6050',
                                fontSize: '0.8rem',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              {reply.content}
                            </p>
                            {authStatus === 'authenticated' && (
                              <button
                                onClick={() => {
                                  setReplyingTo({
                                    rootId: comment.id,
                                    targetName: reply.username ?? t('anonymous'),
                                  })
                                  setReplyText(`@${reply.username ?? t('anonymous')} `)
                                }}
                                className="flex items-center gap-1 mt-1 transition-colors hover:text-yellow-600"
                                style={{
                                  color: '#4a4055',
                                  fontSize: '0.625rem',
                                  cursor: 'pointer',
                                  fontFamily: 'var(--font-body)',
                                }}
                              >
                                <Reply size={10} />
                                {t('reply')}
                              </button>
                            )}
                          </div>
                          {authStatus === 'authenticated' && (
                            <button
                              onClick={() => handleCommentDelete(reply.id)}
                              className="flex-shrink-0 p-1 rounded transition-opacity hover:opacity-70"
                              style={{ color: '#3a2020', cursor: 'pointer' }}
                              title={t('deleteReply')}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* 답글 입력 */}
                      {replyingTo?.rootId === comment.id && (
                        <div
                          className="flex items-start gap-2.5 px-4 py-3"
                          style={{
                            marginLeft: 0,
                            borderLeft: '2px solid rgba(200,144,10,0.2)',
                            borderTop:
                              replies.length > 0
                                ? '1px solid rgba(58,40,18,0.15)'
                                : 'none',
                          }}
                        >
                          <Reply
                            size={14}
                            style={{
                              color: 'rgba(200,144,10,0.3)',
                              marginTop: 4,
                              flexShrink: 0,
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span
                                style={{
                                  color: '#5a5065',
                                  fontSize: '0.6875rem',
                                  fontFamily: 'var(--font-body)',
                                }}
                              >
                                <b style={{ color: '#9a8a70' }}>{replyingTo.targetName}</b>{t('replyingToSuffix')}
                              </span>
                              <button
                                onClick={() => setReplyingTo(null)}
                                className="transition-opacity hover:opacity-70"
                                style={{ color: '#5a5065', cursor: 'pointer' }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                            <textarea
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              maxLength={500}
                              rows={2}
                              placeholder={t('replyPlaceholder')}
                              className="w-full px-3 py-2 text-sm outline-none resize-none"
                              style={{
                                background: '#0a0806',
                                border: '1px solid rgba(200,144,10,0.12)',
                                borderRadius: '4px',
                                color: '#e8dcc8',
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.8rem',
                              }}
                              autoFocus
                            />
                            <div className="flex items-center justify-between mt-1.5">
                              <span
                                style={{
                                  color: '#4a4555',
                                  fontSize: '0.5625rem',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {replyText.length}/500
                              </span>
                              <button
                                onClick={handleReplySubmit}
                                disabled={commentSubmitting || !replyText.trim()}
                                className="px-3 py-1 text-xs font-medium transition-all duration-150 hover:brightness-110"
                                style={{
                                  background: replyText.trim()
                                    ? 'var(--gold)'
                                    : 'rgba(44,28,12,0.5)',
                                  color: replyText.trim() ? 'var(--bg-deep)' : '#5a5070',
                                  borderRadius: '4px',
                                  cursor: replyText.trim() ? 'pointer' : 'default',
                                  fontFamily: 'var(--font-heading)',
                                  opacity: commentSubmitting ? 0.5 : 1,
                                  fontSize: '0.6875rem',
                                }}
                              >
                                {commentSubmitting ? t('submitting') : t('replySubmit')}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div
            className="text-center py-8"
            style={{
              color: '#5a5065',
              fontSize: '0.8125rem',
              fontStyle: 'italic',
              fontFamily: 'var(--font-body)',
            }}
          >
            {t('empty')}
          </div>
        )}

      </SectionBlock>
    </div>
  )
}
