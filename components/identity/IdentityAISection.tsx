'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'

interface IdentityAISectionProps {
  identityId: string
  sinColor: string
  isAdmin?: boolean
  allowedKeywords?: Set<string>
  skillLookup: Record<string, NoteSkillEntry>
  passiveLookup: Record<string, NotePassiveEntry>
  egoLookup: Record<string, NoteEgoEntry>
  identityLookup: Record<string, NoteIdentityEntry>
  egoGiftLookup: Record<string, NoteEgoGiftEntry>
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function IdentityAISection({
  identityId,
  sinColor,
  isAdmin,
  allowedKeywords,
  skillLookup,
  passiveLookup,
  egoLookup,
  identityLookup,
  egoGiftLookup,
}: IdentityAISectionProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 캐시 조회
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/identity-ai?identity_id=${identityId}`)
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        if (!cancelled) {
          setSummary(data.summary)
          setCreatedAt(data.created_at)
        }
      } catch {
        // 캐시 없으면 무시
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [identityId])

  // AI 생성
  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/identity-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity_id: identityId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 생성 실패')
      setSummary(data.summary)
      setCreatedAt(data.created_at)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message || 'AI 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }, [identityId])

  if (loading) {
    return (
      <div className="card p-6" style={{ border: `1px solid ${sinColor}15` }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles style={{ width: '1rem', height: '1rem', color: sinColor }} />
          <span className="font-serif" style={{ color: 'var(--gold)', fontSize: '1rem' }}>AI 분석</span>
        </div>
        <div className="flex items-center justify-center py-6" style={{ color: '#555' }}>
          <Loader2 className="animate-spin" style={{ width: '1.25rem', height: '1.25rem' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6" style={{ border: `1px solid ${sinColor}15` }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles style={{ width: '1rem', height: '1rem', color: sinColor }} />
          <span className="font-serif" style={{ color: 'var(--gold)', fontSize: '1rem' }}>AI 분석</span>
        </div>
        {createdAt && (
          <span style={{ color: '#555', fontSize: '0.75rem' }}>
            {timeAgo(createdAt)} 생성
          </span>
        )}
      </div>

      {/* 본문 */}
      {summary ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <NoteRenderer
              text={summary}
              skillLookup={skillLookup}
              passiveLookup={passiveLookup}
              egoLookup={egoLookup}
              identityLookup={identityLookup}
              egoGiftLookup={egoGiftLookup}
              allowedKeywords={allowedKeywords}
            />
          </div>

          {/* 푸터 */}
          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span style={{ color: '#555', fontSize: '0.6875rem' }}>
              GPT-5.4가 생성한 요약입니다. 실제 게임과 다를 수 있습니다.
            </span>
            {isAdmin && (
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-1 transition-colors"
                style={{
                  color: generating ? '#444' : '#666',
                  fontSize: '0.75rem',
                  cursor: generating ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (!generating) (e.currentTarget.style.color = sinColor) }}
                onMouseLeave={e => { if (!generating) (e.currentTarget.style.color = '#666') }}
              >
                {generating ? (
                  <Loader2 className="animate-spin" style={{ width: '0.75rem', height: '0.75rem' }} />
                ) : (
                  <RefreshCw style={{ width: '0.75rem', height: '0.75rem' }} />
                )}
                재생성
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-6">
          <p style={{ color: '#666', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            AI가 이 인격의 스킬, 운영법, 추천 편성을 분석하여 요약합니다.
          </p>

          {error && (
            <p style={{ color: '#e04040', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
              {error}
            </p>
          )}

          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all"
            style={{
              background: generating ? `${sinColor}20` : `${sinColor}30`,
              color: generating ? '#666' : '#e8dcc8',
              border: `1px solid ${sinColor}50`,
              fontSize: '0.8125rem',
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!generating) { e.currentTarget.style.background = `${sinColor}50`; e.currentTarget.style.borderColor = sinColor } }}
            onMouseLeave={e => { if (!generating) { e.currentTarget.style.background = `${sinColor}30`; e.currentTarget.style.borderColor = `${sinColor}50` } }}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '1rem', height: '1rem' }} />
                AI 분석 중...
              </>
            ) : (
              <>
                <Sparkles style={{ width: '1rem', height: '1rem' }} />
                AI 분석 생성하기
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
