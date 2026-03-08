'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, Copy, Check, Pencil, Bookmark, Share2, GitFork } from 'lucide-react'
import { STORAGE_BASE, SIN_COLORS, SIN_ORDER } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'

const ATK_ICON_URL: Record<string, string> = {
  'slash': `${STORAGE_BASE}/icons/stats/slash.webp`,
  'pierce': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  'blunt': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

function sinIconUrl(sin: string): string {
  const cap = sin.charAt(0).toUpperCase() + sin.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
}

export type DeckHeaderProps = {
  deckId: string
  title: string
  username: string | null | undefined
  date: string
  viewCount: number
  tags: string[]
  keywords: string[]
  isOwner: boolean | undefined
  isAdmin: boolean | undefined
  deckCode: string | undefined
  voted: boolean
  voteCount: number
  voting: boolean
  authStatus: string
  bookmarked: boolean
  bookmarking: boolean
  shared: boolean
  shareGenerating: boolean
  copied: boolean
  sinAffinityTotals: Record<string, number>
  atkTypeTotals: Record<string, number>
  filledSlotsCount: number
  onVote: () => void
  onBookmark: () => void
  onShare: () => void
  onCopyCode: () => void
  onFork: () => void
}

export function DeckSidebarPanel({
  deckId,
  isOwner,
  isAdmin,
  deckCode,
  voted,
  voteCount,
  voting,
  authStatus,
  bookmarked,
  bookmarking,
  shared,
  shareGenerating,
  copied,
  tags,
  keywords,
  sinAffinityTotals,
  atkTypeTotals,
  filledSlotsCount,
  onVote,
  onBookmark,
  onShare,
  onCopyCode,
  onFork,
}: DeckHeaderProps) {
  const { getIconUrl } = useKeywordData()
  return (
    <div className="flex flex-col gap-3" style={{ position: 'sticky', top: 88 }}>
      {/* 추천 */}
      <div
        className="rounded-lg flex flex-col items-center py-5 gap-2"
        style={{ background: '#120e09', border: '1px solid var(--border)' }}
      >
        <button
          onClick={onVote}
          disabled={voting || authStatus !== 'authenticated'}
          className="flex flex-col items-center gap-2 transition-all duration-200"
          style={{ opacity: voting ? 0.5 : 1, cursor: authStatus !== 'authenticated' ? 'default' : 'pointer' }}
          title={authStatus !== 'authenticated' ? '로그인 후 추천 가능' : voted ? '추천 취소' : '추천'}
        >
          <div
            className="flex items-center justify-center rounded-full transition-all duration-300"
            style={{
              width: 48, height: 48,
              background: voted ? 'rgba(200,48,64,0.14)' : 'rgba(44,28,12,0.5)',
              border: `1px solid ${voted ? 'rgba(200,48,64,0.45)' : 'rgba(58,40,18,0.7)'}`,
              boxShadow: voted ? '0 0 16px rgba(200,48,64,0.18)' : 'none',
            }}
          >
            <Heart
              size={20}
              fill={voted ? 'currentColor' : 'none'}
              style={{ color: voted ? '#e05060' : '#5a5070' }}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, color: voted ? '#e05060' : '#9a9ab0' }}>
            {voteCount}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.12em', color: voted ? '#c84050' : (authStatus !== 'authenticated' ? '#222233' : '#8a8a9a') }}>
            {authStatus !== 'authenticated' ? 'LOGIN TO VOTE' : voted ? 'LIKED' : 'LIKE'}
          </span>
        </button>
      </div>

      {/* 수정 */}
      {(isOwner || isAdmin) && (
        <Link
          href={`/decks/${deckId}/edit`}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150 hover:brightness-125"
          style={{
            background: 'rgba(200,144,10,0.1)',
            border: '1px solid rgba(200,144,10,0.3)',
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
          }}
        >
          <Pencil size={11} />
          EDIT DECK
        </Link>
      )}

      {/* 포크 */}
      <button
        onClick={onFork}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150 hover:brightness-125"
        style={{
          background: 'rgba(72,120,160,0.1)',
          border: '1px solid rgba(72,120,160,0.3)',
          color: '#4898b0',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
        }}
      >
        <GitFork size={11} />
        FORK DECK
      </button>

      {/* 편성코드 */}
      {deckCode && (
        <button
          onClick={onCopyCode}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150"
          style={{
            background: copied ? 'rgba(88,136,40,0.12)' : '#120e09',
            border: `1px solid ${copied ? 'rgba(88,136,40,0.4)' : 'var(--border)'}`,
            color: copied ? '#88a830' : '#8a8a9a',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'COPIED!' : 'COPY DECK CODE'}
        </button>
      )}

      {/* 북마크 + 공유 */}
      <div className="flex gap-2">
        <button
          onClick={onBookmark}
          disabled={bookmarking || authStatus !== 'authenticated'}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150"
          style={{
            background: bookmarked ? 'rgba(200,144,10,0.12)' : '#120e09',
            border: `1px solid ${bookmarked ? 'rgba(200,144,10,0.4)' : 'var(--border)'}`,
            color: bookmarked ? 'var(--gold)' : '#8a8a9a',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            opacity: bookmarking ? 0.5 : 1,
            cursor: authStatus !== 'authenticated' ? 'default' : 'pointer',
          }}
          title={authStatus !== 'authenticated' ? '로그인 후 북마크 가능' : bookmarked ? '북마크 해제' : '북마크'}
        >
          <Bookmark size={11} fill={bookmarked ? 'currentColor' : 'none'} />
          {bookmarked ? 'SAVED' : 'SAVE'}
        </button>
        <button
          onClick={onShare}
          disabled={shareGenerating}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150"
          style={{
            background: shared ? 'rgba(88,136,40,0.12)' : '#120e09',
            border: `1px solid ${shared ? 'rgba(88,136,40,0.4)' : 'var(--border)'}`,
            color: shared ? '#88a830' : '#8a8a9a',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            opacity: shareGenerating ? 0.5 : 1,
          }}
        >
          {shared ? <Check size={11} /> : <Share2 size={11} />}
          {shared ? 'COPIED!' : 'SHARE'}
        </button>
      </div>

      {/* 태그 + 키워드 */}
      {(tags.length > 0 || keywords.length > 0) && (
        <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(200,144,10,0.07)', color: 'var(--gold-dim)', border: '1px solid rgba(200,144,10,0.16)', fontFamily: 'var(--font-body)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {keywords.map(kw => {
                const iconUrl = getIconUrl(kw)
                return (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{ background: 'rgba(136,88,40,0.14)', color: '#c8a450', border: '1px solid rgba(136,88,40,0.24)', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
                  >
                    {iconUrl && (
                      <Image src={iconUrl} alt="" width={11} height={11} />
                    )}
                    {kw}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 죄악 자원 & 공격 유형 종합 */}
      {filledSlotsCount > 0 && (
        <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ color: '#9a9ab0', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>죄악 자원</div>
            <div className="flex items-center gap-2 flex-wrap">
              {SIN_ORDER.map(sin => {
                const count = sinAffinityTotals[sin] ?? 0
                if (count === 0) return null
                return (
                  <div key={sin} className="flex items-center gap-1">
                    <Image src={sinIconUrl(sin)} alt="" width={16} height={16} />
                    <span style={{ color: SIN_COLORS[sin], fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

          <div>
            <div style={{ color: '#9a9ab0', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>공격 유형</div>
            <div className="flex items-center gap-3">
              {(['slash', 'pierce', 'blunt'] as const).map(type => {
                const count = atkTypeTotals[type]
                if (count === 0) return null
                return (
                  <div key={type} className="flex items-center gap-1">
                    <Image src={ATK_ICON_URL[type]} alt="" width={15} height={15} />
                    <span style={{ color: '#aaaaaa', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DeckMobileActionBar({
  deckId,
  isOwner,
  isAdmin,
  deckCode,
  voted,
  voteCount,
  voting,
  authStatus,
  bookmarked,
  bookmarking,
  shared,
  shareGenerating,
  copied,
  tags,
  sinAffinityTotals,
  atkTypeTotals,
  filledSlotsCount,
  onVote,
  onBookmark,
  onShare,
  onCopyCode,
  onFork,
}: DeckHeaderProps) {
  return (
    <div className="flex lg:hidden flex-wrap items-center gap-2.5 mb-5 rounded-lg px-4 py-3" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
      {/* 추천 */}
      <button
        onClick={onVote}
        disabled={voting || authStatus !== 'authenticated'}
        className="inline-flex items-center gap-2 transition-all duration-200"
        style={{ opacity: voting ? 0.5 : 1, cursor: authStatus !== 'authenticated' ? 'default' : 'pointer' }}
        title={authStatus !== 'authenticated' ? '로그인 후 추천 가능' : voted ? '추천 취소' : '추천'}
      >
        <div
          className="flex items-center justify-center rounded-full transition-all duration-300"
          style={{
            width: 32, height: 32,
            background: voted ? 'rgba(200,48,64,0.14)' : 'rgba(44,28,12,0.5)',
            border: `1px solid ${voted ? 'rgba(200,48,64,0.45)' : 'rgba(58,40,18,0.7)'}`,
            boxShadow: voted ? '0 0 12px rgba(200,48,64,0.18)' : 'none',
          }}
        >
          <Heart
            size={14}
            fill={voted ? 'currentColor' : 'none'}
            style={{ color: voted ? '#e05060' : '#5a5070' }}
          />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, lineHeight: 1, color: voted ? '#e05060' : '#9a9ab0' }}>
          {voteCount}
        </span>
      </button>

      {/* 북마크 */}
      <button
        onClick={onBookmark}
        disabled={bookmarking || authStatus !== 'authenticated'}
        className="inline-flex items-center justify-center transition-all duration-200"
        style={{ opacity: bookmarking ? 0.5 : 1, cursor: authStatus !== 'authenticated' ? 'default' : 'pointer' }}
        title={authStatus !== 'authenticated' ? '로그인 후 북마크 가능' : bookmarked ? '북마크 해제' : '북마크'}
      >
        <div
          className="flex items-center justify-center rounded-full transition-all duration-300"
          style={{
            width: 32, height: 32,
            background: bookmarked ? 'rgba(200,144,10,0.14)' : 'rgba(44,28,12,0.5)',
            border: `1px solid ${bookmarked ? 'rgba(200,144,10,0.45)' : 'rgba(58,40,18,0.7)'}`,
            boxShadow: bookmarked ? '0 0 12px rgba(200,144,10,0.18)' : 'none',
          }}
        >
          <Bookmark
            size={14}
            fill={bookmarked ? 'currentColor' : 'none'}
            style={{ color: bookmarked ? 'var(--gold)' : '#5a5070' }}
          />
        </div>
      </button>

      {/* 공유 */}
      <button
        onClick={onShare}
        disabled={shareGenerating}
        className="inline-flex items-center justify-center transition-all duration-200"
        style={{ opacity: shareGenerating ? 0.5 : 1 }}
      >
        <div
          className="flex items-center justify-center rounded-full transition-all duration-300"
          style={{
            width: 32, height: 32,
            background: shareGenerating ? 'rgba(200,144,10,0.14)' : 'rgba(44,28,12,0.5)',
            border: `1px solid ${shareGenerating ? 'rgba(200,144,10,0.45)' : 'rgba(58,40,18,0.7)'}`,
          }}
        >
          <Share2 size={14} style={{ color: shareGenerating ? 'var(--gold)' : '#5a5070' }} />
        </div>
      </button>

      {/* 포크 */}
      <button
        onClick={onFork}
        className="inline-flex items-center justify-center transition-all duration-200"
        title="덱 포크"
      >
        <div
          className="flex items-center justify-center rounded-full transition-all duration-300"
          style={{
            width: 32, height: 32,
            background: 'rgba(72,120,160,0.14)',
            border: '1px solid rgba(72,120,160,0.35)',
          }}
        >
          <GitFork size={14} style={{ color: '#4898b0' }} />
        </div>
      </button>

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />

      {/* 수정 */}
      {(isOwner || isAdmin) && (
        <Link
          href={`/decks/${deckId}/edit`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-150 hover:brightness-125"
          style={{
            background: 'rgba(200,144,10,0.1)',
            border: '1px solid rgba(200,144,10,0.3)',
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
          }}
        >
          <Pencil size={10} />
          EDIT
        </Link>
      )}

      {/* 편성코드 */}
      {deckCode && (
        <button
          onClick={onCopyCode}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-150"
          style={{
            background: copied ? 'rgba(88,136,40,0.12)' : 'rgba(44,28,12,0.3)',
            border: `1px solid ${copied ? 'rgba(88,136,40,0.4)' : 'rgba(58,40,18,0.5)'}`,
            color: copied ? '#88a830' : '#8a8a9a',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'COPIED!' : 'COPY CODE'}
        </button>
      )}

      {/* 죄악 자원 + 공격 유형 */}
      {filledSlotsCount > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex items-center gap-2 flex-wrap">
            {SIN_ORDER.map(sin => {
              const count = sinAffinityTotals[sin] ?? 0
              if (count === 0) return null
              return (
                <div key={sin} className="flex items-center gap-0.5">
                  <Image src={sinIconUrl(sin)} alt="" width={14} height={14} />
                  <span style={{ color: SIN_COLORS[sin], fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                </div>
              )
            })}
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.04)' }} />
            {(['slash', 'pierce', 'blunt'] as const).map(type => {
              const count = atkTypeTotals[type]
              if (count === 0) return null
              return (
                <div key={type} className="flex items-center gap-0.5">
                  <Image src={ATK_ICON_URL[type]} alt="" width={13} height={13} />
                  <span style={{ color: '#999', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>{count}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* 태그 */}
      {tags.length > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(200,144,10,0.07)', color: 'var(--gold-dim)', border: '1px solid rgba(200,144,10,0.16)', fontFamily: 'var(--font-body)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
