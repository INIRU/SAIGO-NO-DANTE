'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { ThumbsUp, ThumbsDown, Trash2, Send } from 'lucide-react'

interface Review {
  id: string
  is_positive: boolean
  content: string
  created_at: string
  user_id: string
  username: string | null
  avatar_url: string | null
  role: string
}

interface ReviewData {
  reviews: Review[]
  positiveCount: number
  negativeCount: number
  myReview: Review | null
  total: number
}

interface Props {
  identityId: string
  sinColor: string
}

export default function IdentityReviewSection({ identityId, sinColor }: Props) {
  const { data: session } = useSession()
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [content, setContent] = useState('')
  const [selectedVote, setSelectedVote] = useState<boolean | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`/api/identities/${identityId}/reviews`)
      if (res.ok) {
        const data = await res.json()
        setReviewData(data)
        if (data.myReview) {
          setSelectedVote(data.myReview.is_positive)
          setContent(data.myReview.content || '')
        }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [identityId])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const handleSubmit = async (isPositive: boolean) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/identities/${identityId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_positive: isPositive, content: content.trim() }),
      })
      if (res.ok) {
        setShowForm(false)
        await fetchReviews()
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const handleDelete = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/identities/${identityId}/reviews`, { method: 'DELETE' })
      if (res.ok) {
        setSelectedVote(null)
        setContent('')
        setShowForm(false)
        await fetchReviews()
      }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const positiveCount = reviewData?.positiveCount ?? 0
  const negativeCount = reviewData?.negativeCount ?? 0
  const total = reviewData?.total ?? 0
  const positiveRatio = total > 0 ? Math.round((positiveCount / total) * 100) : 0
  const myReview = reviewData?.myReview

  return (
    <div className="card p-5" style={{ background: '#1a1510', border: '1px solid var(--border)' }}>
      <h2
        className="font-serif font-light mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        유저 평가
      </h2>

      {/* 개추/비추 집계 바 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ThumbsUp size={14} style={{ color: '#4ade80' }} />
            <span className="font-mono text-sm font-bold" style={{ color: '#4ade80' }}>
              {positiveCount}
            </span>
          </div>
          <span className="text-xs" style={{ color: '#999' }}>
            {loading ? '...' : `${total}명 참여`}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold" style={{ color: '#f87171' }}>
              {negativeCount}
            </span>
            <ThumbsDown size={14} style={{ color: '#f87171' }} />
          </div>
        </div>
        {/* 비율 바 */}
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: total > 0 ? '#f8717130' : '#333' }}
        >
          {total > 0 && (
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${positiveRatio}%`,
                background: 'linear-gradient(90deg, #4ade80, #22c55e)',
              }}
            />
          )}
        </div>
        {total > 0 && (
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: '#4ade8088' }}>{positiveRatio}%</span>
            <span className="text-xs" style={{ color: '#f8717188' }}>{100 - positiveRatio}%</span>
          </div>
        )}
      </div>

      {/* 투표 버튼 (로그인 시) */}
      {session?.user && (
        <div className="mb-4">
          {myReview ? (
            <div
              className="flex items-center justify-between p-3 rounded"
              style={{
                background: myReview.is_positive ? '#4ade8010' : '#f8717110',
                border: `1px solid ${myReview.is_positive ? '#4ade8030' : '#f8717130'}`,
              }}
            >
              <div className="flex items-center gap-2">
                {myReview.is_positive
                  ? <ThumbsUp size={14} style={{ color: '#4ade80' }} />
                  : <ThumbsDown size={14} style={{ color: '#f87171' }} />
                }
                <span className="text-xs" style={{ color: '#999' }}>
                  {myReview.is_positive ? '추천함' : '비추천함'}
                  {myReview.content && ` — "${myReview.content}"`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowForm(true); setSelectedVote(myReview.is_positive) }}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: '#aaa', background: '#ffffff08' }}
                >
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="transition-colors"
                  style={{ color: '#999' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ) : !showForm ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(true); setSelectedVote(true) }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded font-medium text-sm transition-all"
                style={{
                  background: '#4ade8012',
                  border: '1px solid #4ade8030',
                  color: '#4ade80',
                }}
              >
                <ThumbsUp size={15} />
                개추
              </button>
              <button
                onClick={() => { setShowForm(true); setSelectedVote(false) }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded font-medium text-sm transition-all"
                style={{
                  background: '#f8717112',
                  border: '1px solid #f8717130',
                  color: '#f87171',
                }}
              >
                <ThumbsDown size={15} />
                비추
              </button>
            </div>
          ) : null}

          {/* 한줄평 작성 폼 */}
          {showForm && (
            <div className="mt-3 space-y-3">
              {/* 개추/비추 토글 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedVote(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-all"
                  style={{
                    background: selectedVote === true ? '#4ade8020' : 'transparent',
                    border: `1px solid ${selectedVote === true ? '#4ade8060' : '#333'}`,
                    color: selectedVote === true ? '#4ade80' : '#666',
                  }}
                >
                  <ThumbsUp size={14} />
                  개추
                </button>
                <button
                  onClick={() => setSelectedVote(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm transition-all"
                  style={{
                    background: selectedVote === false ? '#f8717120' : 'transparent',
                    border: `1px solid ${selectedVote === false ? '#f8717160' : '#333'}`,
                    color: selectedVote === false ? '#f87171' : '#666',
                  }}
                >
                  <ThumbsDown size={14} />
                  비추
                </button>
              </div>
              {/* 한줄평 입력 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={content}
                  onChange={e => setContent(e.target.value.slice(0, 100))}
                  placeholder="한줄평 (선택, 최대 100자)"
                  className="flex-1 px-3 py-2 rounded text-sm"
                  style={{
                    background: '#0d0b08',
                    border: '1px solid var(--border)',
                    color: '#ccc',
                    outline: 'none',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && selectedVote !== null) handleSubmit(selectedVote)
                  }}
                />
                <button
                  onClick={() => selectedVote !== null && handleSubmit(selectedVote)}
                  disabled={submitting || selectedVote === null}
                  className="px-3 py-2 rounded transition-all"
                  style={{
                    background: `${sinColor}20`,
                    border: `1px solid ${sinColor}40`,
                    color: sinColor,
                    opacity: submitting || selectedVote === null ? 0.4 : 1,
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: '#555' }}>
                  {content.length}/100
                </span>
                <button
                  onClick={() => { setShowForm(false); if (!myReview) { setSelectedVote(null); setContent('') } }}
                  className="text-xs"
                  style={{ color: '#999' }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 로그인 안내 */}
      {!session?.user && !loading && (
        <div
          className="text-center py-3 mb-4 rounded text-xs"
          style={{ color: '#999', background: '#ffffff05', border: '1px solid #ffffff08' }}
        >
          로그인하면 평가에 참여할 수 있습니다
        </div>
      )}

      {/* 한줄평 목록 */}
      {(reviewData?.reviews?.length ?? 0) > 0 && (
        <div className="space-y-0">
          <div className="text-xs font-semibold mb-2" style={{ color: '#aaa' }}>
            한줄평
          </div>
          {reviewData!.reviews.slice(0, 20).map(review => (
            <div
              key={review.id}
              className="flex items-start gap-2 py-2"
              style={{ borderBottom: '1px solid #ffffff08' }}
            >
              <div className="shrink-0 mt-0.5">
                {review.is_positive
                  ? <ThumbsUp size={11} style={{ color: '#4ade8080' }} />
                  : <ThumbsDown size={11} style={{ color: '#f8717180' }} />
                }
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs" style={{ color: '#bbb' }}>
                  {review.content}
                </span>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <span
                  className="text-xs"
                  style={{
                    color: review.role === 'wanjang' ? 'var(--gold)' : review.role === 'admin' ? '#f87171' : '#555',
                  }}
                >
                  {review.username ?? '익명'}
                  {review.role === 'wanjang' && ' ★'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && total === 0 && (
        <div className="text-center py-4" style={{ color: '#444', fontSize: '0.75rem' }}>
          아직 평가가 없습니다
        </div>
      )}
    </div>
  )
}
