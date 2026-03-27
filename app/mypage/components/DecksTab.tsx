'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Bookmark, Trash2, X } from 'lucide-react'
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
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1">
          {[
            { key: 'mine' as const, label: '내 덱', count: decks.length },
            { key: 'bookmarks' as const, label: '저장한 덱', count: bookmarkedDecks.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className="px-3 py-1.5 text-xs rounded-md transition-all duration-200"
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
                <span style={{ marginLeft: '0.375rem', fontFamily: 'var(--font-mono)', fontSize: '0.625rem' }}>{count}</span>
              )}
            </button>
          ))}
        </div>
        <Link
          href="/decks/new"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all duration-200 hover:brightness-110 active:scale-95"
          style={{ background: 'var(--gold)', color: 'var(--bg-deep)', borderRadius: '0.25rem', fontFamily: 'var(--font-heading)' }}
        >
          <Plus size={12} />
          새 덱
        </Link>
      </div>

      {/* 내 덱 */}
      {subTab === 'mine' && (
        <>
          {decks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 gap-4"
              style={{ background: 'linear-gradient(180deg, #1a1510 0%, #120e09 100%)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
            >
              <div style={{ color: '#3a2a18', fontSize: '3.5rem', lineHeight: 1, userSelect: 'none' }}>&#x2741;</div>
              <p className="font-serif text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}>아직 작성한 덱이 없습니다.</p>
              <Link
                href="/decks/new"
                className="transition-all duration-200 hover:opacity-90"
                style={{ color: 'var(--bg-deep)', background: 'var(--gold)', fontSize: '0.75rem', padding: '0.375rem 1rem', borderRadius: '0.25rem', fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
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
                      <p className="text-sm font-serif" style={{ color: '#e8dcc8' }}>이 덱을 삭제할까요?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeletingId(null)} className="px-4 py-1.5 text-xs" style={{ color: '#888', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '0.25rem' }}>취소</button>
                        <button onClick={() => handleDelete(deck.id)} className="px-4 py-1.5 text-xs font-medium" style={{ background: 'rgba(139,26,26,0.9)', color: '#ff6060', borderRadius: '0.25rem', cursor: 'pointer', border: '1px solid rgba(139,26,26,0.5)' }}>삭제</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(deck.id)}
                      className="absolute top-2 right-2 p-2 rounded opacity-0 group-hover/card:opacity-100 transition-all duration-200 hover:scale-110 z-10"
                      style={{ background: 'rgba(139,26,26,0.9)', color: '#ff6060', cursor: 'pointer', border: '1px solid rgba(139,26,26,0.5)' }}
                    >
                      <Trash2 size={14} />
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
              className="flex flex-col items-center justify-center py-12 gap-3"
              style={{ background: 'linear-gradient(180deg, #1a1510 0%, #120e09 100%)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
            >
              <Bookmark size={22} style={{ color: '#3a3048', strokeWidth: 1.5 }} />
              <p className="font-serif text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-heading)' }}>아직 저장한 덱이 없습니다.</p>
              <Link href="/decks" style={{ color: 'var(--gold-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-body)' }} className="hover:opacity-80 transition-opacity underline underline-offset-2">
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
                    className="absolute top-2 right-2 p-2 rounded opacity-0 group-hover/card:opacity-100 transition-all duration-200 hover:scale-110 z-10"
                    style={{ background: 'rgba(44,28,12,0.9)', color: 'var(--gold-dim)', cursor: 'pointer', border: '1px solid rgba(200,144,10,0.3)' }}
                    title="북마크 해제"
                  >
                    <X size={14} />
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
