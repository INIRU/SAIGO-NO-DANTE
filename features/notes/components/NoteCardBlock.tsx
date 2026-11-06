'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useLocale } from 'next-intl'
import { Search, X } from 'lucide-react'
import DeckCard, { type DeckSummary } from '@/features/decks/components/DeckCard'
import PlanCard, { type PlanSummary } from '@/features/planner/components/PlanCard'
import BaseModal from '@/components/ui/BaseModal'
import type { CARD_KINDS } from '@/lib/notes/blocks'

export type NoteCardKind = typeof CARD_KINDS[number]
type CardRow = DeckSummary & PlanSummary
const tr = (lang: string, ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko
const fetchCards = async (url: string): Promise<CardRow[]> => {
  const response = await fetch(url)
  if (!response.ok) throw Error('Cards unavailable')
  return response.json()
}
export function NoteCardView({ kind, id }: { kind: NoteCardKind; id: string }) {
  const lang = useLocale()
  const { data, error, isLoading } = useSWR(id ? `/api/notes/cards?kind=${kind}&refs=${encodeURIComponent(id)}` : null, fetchCards, { revalidateOnFocus: false })
  const row = data?.[0]
  if (!id) return null
  return <div className="note-card">
    {row ? kind === 'deck' ? <DeckCard deck={row} /> : <PlanCard plan={row} />
      : <div className="note-card-unavailable" aria-busy={isLoading}>{isLoading ? '…' : error || data ? tr(lang, '찾을 수 없습니다', '見つかりません', 'Not found') : '…'}</div>}
  </div>
}
/**
 * Search window for the card block, in the gift picker's frame (note-direct-picker): search and deck/plan on the left,
 * the matching posts as the board cards on the right. A card is shown, not followed: a transparent button over it picks it.
 */
export function NoteCardPicker({ kind, onKind, onSelect, onClose }: { kind: NoteCardKind; onKind: (kind: NoteCardKind) => void; onSelect: (kind: NoteCardKind, id: string) => void; onClose: () => void }) {
  const lang = useLocale(), [query, setQuery] = useState(''), [debounced, setDebounced] = useState('')
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 200); return () => clearTimeout(timer) }, [query])
  const { data, error, isLoading, mutate } = useSWR(`/api/notes/cards?kind=${kind}&q=${encodeURIComponent(debounced)}`, fetchCards, { revalidateOnFocus: false })
  const title = tr(lang, '덱·플랜 선택', 'デッキ・プランを選択', 'Choose deck or plan')
  const kinds: [NoteCardKind, string][] = [['deck', tr(lang, '덱', 'デッキ', 'Decks')], ['plan', tr(lang, '플랜', 'プラン', 'Plans')]]
  return <BaseModal open onClose={onClose} title={title} maxWidth="78rem" zIndex={10000}>
    <div className="note-picker note-direct-picker note-direct-picker--card">
      <header className="note-picker-header"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={tr(lang, '닫기', '閉じる', 'Close')}><X size={22} /></button></header>
      <div className="note-direct-layout">
        <nav className="note-direct-sidebar" aria-label={tr(lang, '필터', 'フィルター', 'Filters')}>
          <div className="note-picker-controls"><label className="note-picker-search"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={tr(lang, '제목으로 검색', 'タイトルで検索', 'Search by title')} aria-label={tr(lang, '제목으로 검색', 'タイトルで検索', 'Search by title')} /></label></div>
          {kinds.map(([value, label]) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => onKind(value)}>{label}</button>)}
        </nav>
        <div className="note-picker-results">
          {isLoading && !data && <div className="note-card-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="note-card-option note-card-option--empty" />)}</div>}
          {error && <button type="button" onClick={() => { void mutate() }}>{tr(lang, '불러오지 못했습니다. 다시 시도', '読み込み失敗・再試行', 'Could not load. Retry')}</button>}
          {!isLoading && !error && data?.length === 0 && <p className="note-picker-empty" role="status">{tr(lang, '검색 결과가 없습니다', '結果がありません', 'No results')}</p>}
          {!!data?.length && <div className="note-card-grid">{data.map(row => <div key={row.id} className="note-card-option">
            <div className="note-card-option-card" inert>{kind === 'deck' ? <DeckCard deck={row} /> : <PlanCard plan={row} />}</div>
            <button type="button" aria-label={`${row.title} ${tr(lang, '넣기', '挿入', 'Insert')}`} onClick={() => onSelect(kind, row.id)} />
          </div>)}</div>}
        </div>
      </div>
    </div>
  </BaseModal>
}
