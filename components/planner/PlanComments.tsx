'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { MessageCircle, Send } from 'lucide-react'
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
}

export default function PlanComments({ planId }: Props) {
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
    if (!session) { showError('로그인이 필요합니다.'); return }
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
      }
    } catch {
      /* 무시 */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h2
        className="flex items-center gap-2 mb-4 font-semibold"
        style={{ fontSize: '0.875rem', color: '#9ca3af' }}
      >
        <MessageCircle style={{ width: '0.875rem', height: '0.875rem' }} />
        댓글 {comments.length}개
      </h2>

      {replyTo && (
        <div
          className="flex items-center justify-between mb-2 px-3 py-1.5 rounded"
          style={{
            background: 'rgba(200,144,10,0.08)', border: '1px solid rgba(200,144,10,0.2)',
            fontSize: '0.75rem', color: '#c8900a',
          }}
        >
          <span>@{replyTo.username} 에게 답글 작성 중</span>
          <button
            onClick={() => setReplyTo(null)}
            style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            취소
          </button>
        </div>
      )}

      {session ? (
        <div className="flex gap-2 mb-5">
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder={replyTo ? `@${replyTo.username}에게 답글...` : '댓글을 입력하세요 (최대 500자)'}
            maxLength={500}
            rows={2}
            className="flex-1 resize-none"
            style={{
              background: '#1a1510', border: '1px solid #333',
              borderRadius: '0.375rem', color: '#e5e7eb',
              fontSize: '0.875rem', padding: '0.5rem 0.75rem',
              outline: 'none', fontFamily: 'inherit',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleCommentSubmit()
              }
            }}
          />
          <button
            onClick={handleCommentSubmit}
            disabled={submitting || !commentText.trim()}
            className="flex items-center gap-1 transition-all hover:brightness-110 disabled:opacity-40"
            style={{
              padding: '0.5rem 0.875rem',
              background: 'rgba(200,144,10,0.15)', border: '1px solid rgba(200,144,10,0.35)',
              borderRadius: '0.375rem', color: '#e8b030',
              fontSize: '0.75rem', fontWeight: 600,
              cursor: submitting || !commentText.trim() ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            <Send style={{ width: '0.75rem', height: '0.75rem' }} />
            등록
          </button>
        </div>
      ) : (
        <div
          className="text-center py-4 mb-5"
          style={{
            background: '#1a1510', border: '1px solid #222',
            borderRadius: '0.375rem', fontSize: '0.75rem', color: '#6b7280',
          }}
        >
          <Link href="/login" style={{ color: '#e8b030' }}>로그인</Link>
          {' '}후 댓글을 작성할 수 있습니다.
        </div>
      )}

      {commentsLoading ? (
        <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '1rem 0' }}>
          댓글 불러오는 중...
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8" style={{ fontSize: '0.75rem', color: '#4b5563' }}>
          아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.filter(c => !c.parent_id).map(comment => {
            const cNickname = comment.profiles?.username ?? '익명'
            const cAvatar = comment.profiles?.avatar_url ?? DEFAULT_AVATAR_URL
            const replies = comments.filter(c => c.parent_id === comment.id)
            return (
              <div key={comment.id}>
                <div
                  className="flex gap-3 p-4"
                  style={{ background: '#1a1510', border: '1px solid #222', borderRadius: '0.375rem' }}
                >
                  <div
                    className="relative overflow-hidden rounded-full"
                    style={{ width: '1.75rem', height: '1.75rem', flexShrink: 0 }}
                  >
                    <Image
                      src={cAvatar} alt={cNickname} width={28} height={28}
                      style={{ width: '1.75rem', height: '1.75rem', objectFit: 'cover' }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{cNickname}</span>
                      <RelativeTime date={comment.created_at} style={{ fontSize: '0.75rem', color: '#4b5563' }} />
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#e5e7eb', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {comment.content}
                    </p>
                    {session && (
                      <button
                        onClick={() => setReplyTo({ id: comment.id, username: cNickname })}
                        style={{ marginTop: '0.375rem', fontSize: '0.6875rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        답글
                      </button>
                    )}
                  </div>
                </div>
                {replies.map(reply => {
                  const rNickname = reply.profiles?.username ?? '익명'
                  const rAvatar = reply.profiles?.avatar_url ?? DEFAULT_AVATAR_URL
                  return (
                    <div
                      key={reply.id}
                      className="flex gap-3 p-4"
                      style={{
                        background: 'rgba(200,144,10,0.03)', border: '1px solid #222',
                        borderRadius: '0.375rem', marginLeft: '1.5rem', marginTop: '0.375rem',
                      }}
                    >
                      <div
                        className="relative overflow-hidden rounded-full"
                        style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0 }}
                      >
                        <Image
                          src={rAvatar} alt={rNickname} width={24} height={24}
                          style={{ width: '1.5rem', height: '1.5rem', objectFit: 'cover' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{rNickname}</span>
                          <RelativeTime date={reply.created_at} style={{ fontSize: '0.75rem', color: '#4b5563' }} />
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#e5e7eb', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
