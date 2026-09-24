'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useEffect, useMemo } from 'react'
import { Play, Search, X, RotateCcw } from 'lucide-react'
import GiftArtwork from '@/components/ui/GiftArtwork'
import RunCaptureGuide from './RunCaptureGuide'
import { DIFFICULTY_CONFIG, type Difficulty } from '@/lib/planner/types'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { GiftData, IdentityData, SinnerData, EgoData } from '@/lib/planner/types'
import { loadRunDraft } from '@/lib/planner/encoder'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
}

const DIFFICULTIES: Difficulty[] = ['normal', 'hard', 'overlap', 'extreme']

export default function RunSetup({ state, dispatch, gifts, giftMap }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const giftName = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const [giftSearch, setGiftSearch] = useState('')
  const [draft, setDraft] = useState<ReturnType<typeof loadRunDraft>>(null)
  useEffect(() => { setDraft(loadRunDraft()) }, [])

  const searchResults = useMemo(() => {
    if (!giftSearch.trim()) return []
    return gifts.filter(g => giftName(g).toLocaleLowerCase().includes(giftSearch.trim().toLocaleLowerCase())).slice(0, 15)
  }, [giftSearch, gifts, locale])

  const inventoryGifts = useMemo(() =>
    state.giftInventory.map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  return (
    <div className="space-y-5 min-w-0">
      <section className="border-b border-[var(--border)] pb-3">
        <h2 className="font-[family-name:var(--font-heading)] text-lg text-[var(--gold-light)]">{t(state.sourcePlanSnapshot ? 'planMode' : 'recordMode')}</h2>
        <p className="mt-1 break-keep text-xs leading-5 text-[var(--text-secondary)]">{t('setupHelp')}</p>
        {state.startFloor > 1 && <p role="status" className="mt-2 text-sm text-amber-400">{t('limited')}</p>}
      </section>
      {/* The capture button only exists once the run starts, so the game waits before Enter until it is connected. */}
      <RunCaptureGuide />
      {/* 난이도 선택 */}
      <section>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>{t('difficulty')}</h2>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map(d => {
            const active = state.difficulty === d
            return (
              <button
                key={d}
                onClick={() => dispatch({ type: 'INIT', difficulty: d, startFloor: state.startFloor })}
                className="rounded-lg transition-all"
                style={{
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: active ? 700 : 400,
                  background: active ? 'rgba(200,144,10,0.15)' : '#1a1510',
                  border: `1px solid ${active ? '#c8900a' : '#2a2015'}`,
                  color: active ? '#e8b030' : '#888',
                  minHeight: '2.75rem',
                }}
              >
                {t(`difficulty_${d}`)}
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
          {t('floorCount', { count: DIFFICULTY_CONFIG[state.difficulty].floors })}
        </p>
      </section>

      {/* 시작 층 */}
      <section>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>{t('startFloor')}</h2>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: state.maxFloors }, (_, i) => i + 1).map(floor => {
            const active = state.startFloor === floor
            return (
              <button
                key={floor}
                onClick={() => dispatch({ type: 'INIT', difficulty: state.difficulty, startFloor: floor })}
                className="rounded transition-all"
                style={{
                  width: '2.75rem', height: '2.75rem',
                  fontSize: '0.8125rem', fontWeight: active ? 700 : 400,
                  background: active ? '#c8900a' : '#1a1510',
                  color: active ? '#0d0b08' : '#888',
                  border: `1px solid ${active ? '#c8900a' : '#2a2015'}`,
                }}
              >
                {floor}
              </button>
            )
          })}
        </div>
      </section>

      {/* 기존 기프트 (중간 진입) */}
      {state.startFloor > 1 && (
        <section>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>{t('startingGifts')}</h2>
          <div className="relative" style={{ marginBottom: '0.75rem' }}>
            <Search className="absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.875rem', height: '0.875rem', color: '#555' }} />
            <input
              type="text"
              aria-label={t('searchGifts')}
              value={giftSearch}
              onChange={e => setGiftSearch(e.target.value)}
              placeholder={t('searchGifts')}
              className="w-full rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                background: '#1a1510', border: '1px solid #2a2015', color: '#e8e0d0',
                fontSize: '0.8125rem', outline: 'none',
              }}
            />
          </div>
          {searchResults.length > 0 && (
            <div className="rounded-lg mb-3" style={{ background: '#1a1510', border: '1px solid #2a2015', maxHeight: '12rem', overflowY: 'auto' }}>
              {searchResults.map(gift => (
                <button
                  key={gift.id}
                  onClick={() => { dispatch({ type: 'ACQUIRE_GIFT', giftId: String(gift.game_id) }); setGiftSearch('') }}
                  className="w-full flex items-center gap-2 transition-colors"
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', textAlign: 'left', color: '#ccc', minHeight: '2.75rem' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span className="w-8 shrink-0"><GiftArtwork gift={gift} displayName={giftName(gift)} sizes="32px" /></span>
                  {giftName(gift)}
                  {gift.keyword && <span style={{ color: '#666' }}>({gift.keyword})</span>}
                </button>
              ))}
            </div>
          )}
          {inventoryGifts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {inventoryGifts.map((gift, i) => (
                <span key={`${gift.game_id}-${i}`} className="inline-flex items-center gap-1 rounded" style={{ background: '#2a2015', padding: '0.375rem 0.5rem', fontSize: '0.6875rem', color: '#ccc' }}>
                  {giftName(gift)}
                  <button aria-label={t('removeGift', { name: giftName(gift) })} onClick={() => dispatch({ type: 'REMOVE_GIFT', giftId: String(gift.game_id) })} style={{ color: '#666', padding: '0.25rem' }}>
                    <X style={{ width: '0.75rem', height: '0.75rem' }} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 이전 런 복원 */}
      {draft && (
        <section className="rounded-lg" style={{ background: '#1a1510', border: '1px solid #2a2015', padding: '1rem' }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t('resumeRun')}</p>
              <p style={{ fontSize: '0.6875rem', color: '#888' }}>{draft.label}</p>
            </div>
            <button
              onClick={() => dispatch({ type: 'LOAD_RUN', state: draft.state })}
              className="inline-flex items-center gap-1 rounded-lg shrink-0"
              style={{ background: 'rgba(200,144,10,0.1)', border: '1px solid rgba(200,144,10,0.3)', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#e8b030', minHeight: '2.75rem' }}
            >
              <RotateCcw style={{ width: '0.75rem', height: '0.75rem' }} /> {t('restore')}
            </button>
          </div>
        </section>
      )}

      {/* 시작 */}
      <button
        onClick={() => dispatch({ type: 'START_RUN' })}
        className="w-full rounded-lg transition-all"
        style={{
          padding: '0.875rem', fontSize: '1rem', fontWeight: 700,
          background: '#c8900a', color: '#0d0b08',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        <Play style={{ width: '1.125rem', height: '1.125rem' }} />
        {t('start')}
      </button>
    </div>
  )
}
