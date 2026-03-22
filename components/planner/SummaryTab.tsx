'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Copy, Save, Database, Check } from 'lucide-react'
import type { PlannerState, PlannerAction, ThemeData, GiftData, IdentityData, SinnerData } from '@/lib/planner/types'
import { DIFFICULTY_CONFIG } from '@/lib/planner/types'
import { computeKeywordDistribution } from '@/lib/planner/fusion'
import { encodePlan, saveDraftToLocal } from '@/lib/planner/encoder'

interface SummaryTabProps {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
  sinners: SinnerData[]
}

export default function SummaryTab({ state, dispatch, themes, gifts, giftMap, identities, sinners }: SummaryTabProps) {
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const themeMap = new Map(themes.map(t => [t.id, t]))
  const sinnerMap = new Map(sinners.map(s => [s.id, s]))

  const keywordDistribution = computeKeywordDistribution(
    state.identitySlots.map(slot => slot.keywords)
  )

  const selectedFloors = state.floorPlan.filter(f => f.theme_id !== null)

  function handleCopyUrl() {
    try {
      const encoded = encodePlan(state)
      const url = `${window.location.origin}/planner?p=${encoded}`
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } catch {
      // copy failed silently
    }
  }

  function handleSaveDraft() {
    saveDraftToLocal(state)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Title / description inputs */}
      <section style={{
        background: '#1a1510',
        border: '1px solid #222',
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
      }}>
        <input
          type="text"
          placeholder="플랜 제목..."
          value={state.title}
          onChange={e => dispatch({ type: 'SET_TITLE', title: e.target.value })}
          maxLength={80}
          style={{
            background: '#0d0b08',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.9375rem',
            color: '#e8b030',
            fontWeight: 700,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <textarea
          placeholder="설명 (선택)..."
          value={state.description}
          onChange={e => dispatch({ type: 'SET_DESCRIPTION', description: e.target.value })}
          rows={3}
          maxLength={500}
          style={{
            background: '#0d0b08',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8125rem',
            color: '#e5e7eb',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            lineHeight: 1.6,
          }}
        />
      </section>

      {/* Plan overview */}
      <section style={{
        background: '#1a1510',
        border: '1px solid #222',
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
      }}>
        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>플랜 개요</div>

        {/* Difficulty + counts */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <StatChip label="난이도" value={DIFFICULTY_CONFIG[state.difficulty].label} />
          <StatChip label="층수" value={`${DIFFICULTY_CONFIG[state.difficulty].floors}층`} />
          <StatChip label="인격" value={`${state.identitySlots.length}개`} />
          <StatChip label="EGO" value={`${state.egoSlots.length}개`} />
          <StatChip label="기프트" value={`${state.giftInventory.length}개`} />
          <StatChip label="테마팩" value={`${selectedFloors.length}층 선택`} />
        </div>

        {/* Identity deck list */}
        {state.identitySlots.length > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.375rem' }}>인격 편성</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {state.identitySlots
                .slice()
                .sort((a, b) => a.slot_order - b.slot_order)
                .map(slot => {
                  const sinner = sinnerMap.get(slot.sinner_id)
                  return (
                    <div key={slot.identity_id} style={{
                      background: '#0d0b08',
                      border: '1px solid #2a2520',
                      borderRadius: '0.375rem',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      color: '#e5e7eb',
                    }}>
                      <span style={{ color: '#8a6010', marginRight: '0.25rem' }}>
                        {sinner?.name_kr ?? '?'}
                      </span>
                      {slot.name_kr}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Keyword distribution */}
        {keywordDistribution.length > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.375rem' }}>키워드 분포</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {keywordDistribution.slice(0, 8).map(({ keyword, count }) => {
                const max = keywordDistribution[0].count
                return (
                  <div key={keyword} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#e5e7eb', width: '3.5rem', flexShrink: 0 }}>{keyword}</span>
                    <div style={{ flex: 1, height: '0.25rem', background: '#222', borderRadius: '0.25rem', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(count / max) * 100}%`,
                        background: '#c8900a',
                        borderRadius: '0.25rem',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#8a6010', width: '1.25rem', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Floor plan summary */}
      {selectedFloors.length > 0 && (
        <section style={{
          background: '#1a1510',
          border: '1px solid #222',
          borderRadius: '0.5rem',
          padding: '0.875rem 1rem',
        }}>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.625rem' }}>층별 테마팩</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {selectedFloors.map(f => {
              const theme = f.theme_id ? themeMap.get(f.theme_id) : null
              if (!theme) return null
              return (
                <div key={f.floor} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.375rem 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    color: '#6b7280',
                    width: '2.5rem',
                    flexShrink: 0,
                  }}>
                    {f.floor}층
                  </span>
                  {theme.image_url && (
                    <Image
                      src={theme.image_url}
                      alt={theme.name}
                      width={18}
                      height={31}
                      style={{ width: '1.125rem', height: '1.9375rem', objectFit: 'cover', borderRadius: '0.125rem', flexShrink: 0 }}
                    />
                  )}
                  <span style={{ fontSize: '0.8125rem', color: '#e5e7eb', flex: 1 }}>{theme.name}</span>
                  {theme.boss_image_url && (
                    <Image
                      src={theme.boss_image_url}
                      alt="보스"
                      width={28}
                      height={32}
                      style={{ width: '1.75rem', height: '2rem', objectFit: 'contain', opacity: 0.6, flexShrink: 0 }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Action buttons */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <button
          onClick={handleCopyUrl}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(200,144,10,0.12)',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(200,144,10,0.4)'}`,
            borderRadius: '0.5rem',
            color: copied ? '#4ade80' : '#e8b030',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'URL 복사 완료!' : 'URL 복사'}
        </button>

        <button
          onClick={handleSaveDraft}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            background: saved ? 'rgba(34,197,94,0.12)' : '#1a1510',
            border: `1px solid ${saved ? 'rgba(34,197,94,0.35)' : '#333'}`,
            borderRadius: '0.5rem',
            color: saved ? '#4ade80' : '#9ca3af',
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? '임시 저장 완료!' : '임시 저장 (브라우저)'}
        </button>

        <button
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            background: '#1a1510',
            border: '1px solid #222',
            borderRadius: '0.5rem',
            color: '#4b5563',
            fontSize: '0.875rem',
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
          title="로그인 후 이용 가능"
        >
          <Database size={16} />
          DB 저장 (로그인 필요)
        </button>
      </section>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#0d0b08',
      border: '1px solid #2a2520',
      borderRadius: '0.375rem',
      padding: '0.25rem 0.625rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <span style={{ fontSize: '0.5625rem', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: '#e8b030', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
