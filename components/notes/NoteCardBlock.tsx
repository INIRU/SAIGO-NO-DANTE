'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useLocale } from 'next-intl'
import { Search, X } from 'lucide-react'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
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
/** Search window for the card block: decks or plans by title, shown as the board cards. */
export function NoteCardPicker({ kind, onKind, onSelect, onClose }: { kind: NoteCardKind; onKind: (kind: NoteCardKind) => void; onSelect: (kind: NoteCardKind, id: string) => void; onClose: () => void }) {
  const lang = useLocale(), [query, setQuery] = useState(''), [debounced, setDebounced] = useState('')
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 200); return () => clearTimeout(timer) }, [query])
  const { data, error, isLoading, mutate } = useSWR(`/api/notes/cards?kind=${kind}&q=${encodeURIComponent(debounced)}`, fetchCards, { revalidateOnFocus: false })
  const title = tr(lang, '덱·플랜 선택', 'デッキ・プランを選択', 'Choose deck or plan')
  const kinds: [NoteCardKind, string][] = [['deck', tr(lang, '덱', 'デッキ', 'Deck')], ['plan', tr(lang, '플랜', 'プラン', 'Plan')]]
  return <BaseModal open onClose={onClose} title={title} maxWidth="48rem" zIndex={10000}>
    <div className="note-picker">
      <header className="note-picker-header"><h2>{title}</h2><button type="button" onClick={onClose} aria-label={tr(lang, '닫기', '閉じる', 'Close')}><X size={20} /></button></header>
      <div className="note-card-kind">{kinds.map(([value, label]) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => onKind(value)}>{label}</button>)}</div>
      <label className="note-picker-search"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={tr(lang, '제목으로 검색', 'タイトルで検索', 'Search by title')} aria-label={tr(lang, '제목 검색', 'タイトル検索', 'Search by title')} /></label>
      {isLoading && <p role="status">{tr(lang, '불러오는 중…', '読み込み中…', 'Loading…')}</p>}
      {error && <button type="button" onClick={() => { void mutate() }}>{tr(lang, '불러오지 못했습니다. 다시 시도', '読み込み失敗・再試行', 'Could not load. Retry')}</button>}
      {!isLoading && !error && data?.length === 0 && <p>{tr(lang, '검색 결과가 없습니다', '結果がありません', 'No results')}</p>}
      <div className="note-card-results">{data?.map(row => <button type="button" key={row.id} onClick={() => onSelect(kind, row.id)}>{row.title}<small>{row.username ?? row.profiles?.username ?? ''}</small></button>)}</div>
    </div>
  </BaseModal>
}
