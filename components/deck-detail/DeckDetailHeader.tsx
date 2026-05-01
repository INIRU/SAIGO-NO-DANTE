'use client'

import Image from 'next/image'
import { Link } from '@/lib/i18n/navigation'
import { Heart, Copy, Check, Pencil, Bookmark, Share2, GitFork } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { STORAGE_BASE, SIN_COLORS, SIN_ORDER } from '@/lib/data/sinners'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n'

const ATK_ICON_URL: Record<string, string> = {
  'slash': `${STORAGE_BASE}/icons/stats/slash.webp`,
  'pierce': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  'blunt': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

const sidebarActionTextStyle = {
  fontFamily: 'var(--font-heading), var(--font-scdream), sans-serif',
  fontSize: '0.8125rem',
  fontWeight: 800,
  lineHeight: 1.05,
  letterSpacing: '0.045em',
  textShadow: '0 0.0625rem 0.125rem rgba(0, 0, 0, 0.92)',
}

const EMPTY_TOTALS: Record<string, number> = {}

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
  egoCostTotals?: Record<string, number>
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
  egoCostTotals = EMPTY_TOTALS,
  atkTypeTotals,
  filledSlotsCount,
  onVote,
  onBookmark,
  onShare,
  onCopyCode,
  onFork,
}: DeckHeaderProps) {
  const { getIconUrl } = useKeywordData()
  const keywordMessages = useKeywords()
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks.detail')
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
          title={authStatus !== 'authenticated' ? t('loginToVote') : voted ? t('undoVote') : t('vote')}
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, color: voted ? '#e05060' : 'var(--text-secondary)' }}>
            {voteCount}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.12em', color: voted ? '#c84050' : (authStatus !== 'authenticated' ? '#222233' : 'var(--text-tertiary)') }}>
            {authStatus !== 'authenticated' ? t('loginToVote') : voted ? t('undoVote') : t('vote')}
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
            ...sidebarActionTextStyle,
          }}
        >
          <Pencil size={13} strokeWidth={2.4} />
          {t('editDeck')}
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
          ...sidebarActionTextStyle,
        }}
      >
        <GitFork size={13} strokeWidth={2.4} />
        {t('forkDeck')}
      </button>

      {/* 편성코드 */}
      {deckCode && (
        <button
          onClick={onCopyCode}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150"
          style={{
            background: copied ? 'rgba(88,136,40,0.12)' : '#120e09',
            border: `1px solid ${copied ? 'rgba(88,136,40,0.4)' : 'var(--border)'}`,
            color: copied ? '#88a830' : 'var(--text-tertiary)',
            ...sidebarActionTextStyle,
          }}
        >
          {copied ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={2.4} />}
          {copied ? t('copied') : t('copyDeckCode')}
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
            color: bookmarked ? 'var(--gold)' : 'var(--text-tertiary)',
            ...sidebarActionTextStyle,
            opacity: bookmarking ? 0.5 : 1,
            cursor: authStatus !== 'authenticated' ? 'default' : 'pointer',
          }}
          title={authStatus !== 'authenticated' ? t('loginToBookmark') : bookmarked ? t('undoBookmark') : t('bookmark')}
        >
          <Bookmark size={13} strokeWidth={2.4} fill={bookmarked ? 'currentColor' : 'none'} />
          {bookmarked ? t('saved') : t('save')}
        </button>
        <button
          onClick={onShare}
          disabled={shareGenerating}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-150"
          style={{
            background: shared ? 'rgba(88,136,40,0.12)' : '#120e09',
            border: `1px solid ${shared ? 'rgba(88,136,40,0.4)' : 'var(--border)'}`,
            color: shared ? '#88a830' : 'var(--text-tertiary)',
            ...sidebarActionTextStyle,
            opacity: shareGenerating ? 0.5 : 1,
          }}
        >
          {shared ? <Check size={13} strokeWidth={2.4} /> : <Share2 size={13} strokeWidth={2.4} />}
          {shared ? t('copied') : t('share')}
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
                    {localizeDeckKeyword(kw, keywordMessages[kw], locale)}
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
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>{t('sinResourceCost')}</div>
            <div className="flex items-center gap-2 flex-wrap">
              {SIN_ORDER.map(sin => {
                const count = sinAffinityTotals[sin] ?? 0
                const cost = egoCostTotals[sin] ?? 0
                if (count === 0 && cost === 0) return null
                const color = cost > 0 && count < cost ? '#cc4444' : SIN_COLORS[sin]
                return (
                  <div key={sin} className="flex items-center gap-1">
                    <Image src={sinIconUrl(sin)} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem' }} />
                    <span style={{ color, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>
                      {cost > 0 ? `${count}/${cost}` : count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />

          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 6 }}>{t('attackTypes')}</div>
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
  egoCostTotals = EMPTY_TOTALS,
  atkTypeTotals,
  filledSlotsCount,
  onVote,
  onBookmark,
  onShare,
  onCopyCode,
  onFork,
}: DeckHeaderProps) {
  const t = useTranslations('decks.detail')
  return (
    <div className="flex lg:hidden flex-wrap items-center gap-2.5 mb-5 rounded-lg px-4 py-3" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
      {/* 추천 */}
      <button
        onClick={onVote}
        disabled={voting || authStatus !== 'authenticated'}
        className="inline-flex items-center gap-2 transition-all duration-200"
        style={{ opacity: voting ? 0.5 : 1, cursor: authStatus !== 'authenticated' ? 'default' : 'pointer' }}
        aria-label={authStatus !== 'authenticated' ? t('loginToVote') : voted ? t('undoVote') : t('vote')}
        title={authStatus !== 'authenticated' ? t('loginToVote') : voted ? t('undoVote') : t('vote')}
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, lineHeight: 1, color: voted ? '#e05060' : 'var(--text-secondary)' }}>
          {voteCount}
        </span>
      </button>

      {/* 북마크 */}
      <button
        onClick={onBookmark}
        disabled={bookmarking || authStatus !== 'authenticated'}
        className="inline-flex items-center justify-center transition-all duration-200"
        style={{ opacity: bookmarking ? 0.5 : 1, cursor: authStatus !== 'authenticated' ? 'default' : 'pointer' }}
        aria-label={authStatus !== 'authenticated' ? t('loginToBookmark') : bookmarked ? t('undoBookmark') : t('bookmark')}
        title={authStatus !== 'authenticated' ? t('loginToBookmark') : bookmarked ? t('undoBookmark') : t('bookmark')}
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
        aria-label={shared ? t('shareCopied') : t('share')}
        title={shared ? t('shareCopied') : t('share')}
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
        aria-label={t('fork')}
        title={t('fork')}
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
          {t('edit')}
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
            color: copied ? '#88a830' : 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? t('copied') : t('code')}
        </button>
      )}

      {/* 죄악 자원 + 공격 유형 */}
      {filledSlotsCount > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex items-center gap-2 flex-wrap">
            {SIN_ORDER.map(sin => {
              const count = sinAffinityTotals[sin] ?? 0
              const cost = egoCostTotals[sin] ?? 0
              if (count === 0 && cost === 0) return null
              const color = cost > 0 && count < cost ? '#cc4444' : SIN_COLORS[sin]
              return (
                <div key={sin} className="flex items-center gap-0.5">
                  <Image src={sinIconUrl(sin)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />
                  <span style={{ color, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>
                    {cost > 0 ? `${count}/${cost}` : count}
                  </span>
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
