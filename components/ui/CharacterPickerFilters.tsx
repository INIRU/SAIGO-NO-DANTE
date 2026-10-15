'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Search, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { getSinnerLogoUrl, getEgoGradeBannerUrl } from '@/lib/utils/images'
import { STORAGE_BASE } from '@/lib/constants/game'

export default function CharacterPickerFilters({ query, onQuery, grade, onGrade, grades, count, sinner = '', onSinner, sinners = [], onReset, canReset }: {
  query: string; onQuery: (value: string) => void
  grade: string; onGrade: (value: string) => void
  grades: { value: string; label: string }[]; count: number
  sinner?: string; onSinner?: (value: string) => void
  sinners?: { id: string; name: string }[]
  /** Replaces what reset clears (by default the search, the grade and the sinner); `canReset` then says when it is on. */
  onReset?: () => void; canReset?: boolean
}) {
  const lang = useLocale(), [expanded, setExpanded] = useState(false)
  const tr = (ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko
  const all = tr('전체', 'すべて', 'All')
  return <div className="character-picker-filters">
    <label className="character-picker-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={e => onQuery(e.target.value)} placeholder={tr('이름 검색', '名前で検索', 'Search names')} aria-label={tr('이름으로 검색', '名前で検索', 'Search by name')} /></label>
    <div className="character-picker-grades" role="group" aria-label={tr('등급', 'ランク', 'Grade')}>
      <button type="button" aria-pressed={!grade} onClick={() => onGrade('')}>{all}</button>
      {grades.map(g => <button key={g.value} type="button" aria-label={g.label} aria-pressed={grade === g.value} onClick={() => onGrade(g.value)}><img src={/^[1-3]$/.test(g.value) ? `${STORAGE_BASE}/icons/Rarity/${g.value}star.webp` : getEgoGradeBannerUrl(g.value)} alt={g.label} width={/^[1-3]$/.test(g.value) ? Number(g.value) * 20 : 40} height={20} className={/^[1-3]$/.test(g.value) ? 'character-picker-rarity' : 'character-picker-ego-grade'} /></button>)}
    </div>
    {onSinner && <>
      <button className="character-picker-filter-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={15} />{sinners.find(s => s.id === sinner)?.name ?? tr('수감자 필터', '囚人フィルター', 'Sinner filter')}</button>
      <div className="character-picker-sinners" data-expanded={expanded} role="group" aria-label={tr('수감자', '囚人', 'Sinner')}>
        <button type="button" aria-pressed={!sinner} onClick={() => onSinner('')}>{all}</button>
        {sinners.map(s => <button key={s.id} type="button" aria-pressed={sinner === s.id} onClick={() => onSinner(s.id)}><img src={getSinnerLogoUrl(s.id)} alt="" width={24} height={24} />{s.name}</button>)}
      </div>
    </>}
    <div className="character-picker-result-count"><span role="status" aria-live="polite">{tr(`${count}개`, `${count}件`, `${count} results`)}</span><button type="button" disabled={onReset ? !canReset : !query && !grade && !sinner} onClick={onReset ?? (() => { onQuery(''); onGrade(''); onSinner?.('') })}><RotateCcw size={14} aria-hidden="true" />{tr('초기화', 'リセット', 'Reset')}</button></div>
  </div>
}
