'use client'

import { useState } from 'react'
import { Link } from '@/lib/i18n/navigation'
import { Plus, Bookmark, Layers, Trash2, X } from 'lucide-react'
import DeckCard, { DeckSummary } from '@/components/decks/DeckCard'

// Design Ref: §5.3 — 내 덱 + 북마크

type Props = {
  decks: DeckSummary[]
  bookmarkedDecks: DeckSummary[]
  onDeleteDeck: (id: string) => Promise<void>
  onRemoveBookmark: (id: string) => Promise<void>
}

export default function DecksTab({ decks, bookmarkedDecks, onDeleteDeck, onRemoveBookmark }: Props) {
  const [subTab, setSubTab] = useState<'mine' | 'bookmarks'>('mine')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    await onDeleteDeck(id)
    setDeletingId(null)
  }

  return (
    <>
      {/* 서브탭 + CTA */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { key: 'mine' as const, label: '내 덱', count: decks.length },
            { key: 'bookmarks' as const, label: '저장한 덱', count: bookmarkedDecks.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className="min-h-11 rounded-md px-3 text-[0.9375rem] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              style={{
                background: subTab === key ? 'rgba(200,144,10,0.1)' : 'transparent',
                color: subTab === key ? 'var(--gold)' : 'var(--text-tertiary)',
                border: subTab === key ? '1px solid rgba(200,144,10,0.2)' : '1px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {label}
              {count > 0 && (
                <span style={{ marginLeft: '0.375rem', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{count}</span>
              )}
            </button>
          ))}
        </div>
        <Link
          href="/decks/new"
          className="flex min-h-11 items-center gap-1.5 rounded px-4 text-[0.9375rem] font-medium transition-all duration-200 hover:brightness-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '0.25rem', fontFamily: 'var(--font-heading)' }}
        >
          <Plus size={16} aria-hidden="true" />
          새 덱
        </Link>
      </div>

      {/* 내 덱 */}
      {subTab === 'mine' && (
        <>
          {decks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-4 rounded-lg border border-[var(--border)] bg-[#1a1510] py-16"
            >
              <Layers size={30} style={{ color: '#3a2a18', strokeWidth: 1.5 }} aria-hidden="true" />
              <p className="font-serif text-[1rem]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}>아직 작성한 덱이 없습니다.</p>
              <Link
                href="/decks/new"
                className="inline-flex min-h-11 items-center rounded px-4 transition-all duration-200 hover:opacity-90"
                style={{ color: 'var(--bg-deep)', background: 'var(--gold)', fontSize: '0.9375rem', fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
              >
                첫 번째 덱 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {decks.map(deck => (
                <div key={deck.id} className="relative group/card flex flex-col [&>*:first-child]:flex-1">
                  <DeckCard deck={deck} />
                  {deletingId === deck.id ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10" style={{ background: 'rgba(13,11,8,0.92)', borderRadius: '0.375rem' }}>
                      <p className="font-serif text-[1rem]" style={{ color: '#e8dcc8' }}>이 덱을 삭제할까요?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeletingId(null)} className="min-h-11 rounded px-4 text-[0.9375rem]" style={{ color: '#888', cursor: 'pointer', border: '1px solid var(--border)' }}>취소</button>
                        <button onClick={() => handleDelete(deck.id)} className="min-h-11 rounded px-4 text-[0.9375rem] font-medium" style={{ background: 'rgba(139,26,26,0.9)', color: '#ff6060', cursor: 'pointer', border: '1px solid rgba(139,26,26,0.5)' }}>삭제</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(deck.id)}
                      className="absolute right-2 top-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded opacity-0 transition-all duration-200 hover:scale-105 group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                      style={{ background: 'rgba(139,26,26,0.9)', color: '#ff6060', cursor: 'pointer', border: '1px solid rgba(139,26,26,0.5)' }}
                      aria-label="덱 삭제"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 북마크 */}
      {subTab === 'bookmarks' && (
        <>
          {bookmarkedDecks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[#1a1510] py-12"
            >
              <Bookmark size={28} style={{ color: '#3a3048', strokeWidth: 1.5 }} aria-hidden="true" />
              <p className="font-serif text-[1rem]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}>아직 저장한 덱이 없습니다.</p>
              <Link href="/decks" style={{ color: 'var(--gold-dim)', fontSize: '0.9375rem', fontFamily: 'var(--font-body)' }} className="inline-flex min-h-11 items-center hover:opacity-80 transition-opacity underline underline-offset-2">
                덱 게시판 둘러보기 &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {bookmarkedDecks.map(deck => (
                <div key={deck.id} className="relative group/card flex flex-col [&>*:first-child]:flex-1">
                  <DeckCard deck={deck} />
                  <button
                    onClick={() => onRemoveBookmark(deck.id)}
                    className="absolute right-2 top-2 z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded opacity-0 transition-all duration-200 hover:scale-105 group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                    style={{ background: 'rgba(44,28,12,0.9)', color: 'var(--gold-dim)', cursor: 'pointer', border: '1px solid rgba(200,144,10,0.3)' }}
                    aria-label="북마크 해제"
                    title="북마크 해제"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
