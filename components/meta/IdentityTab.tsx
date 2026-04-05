'use client'

import Image from 'next/image'
import { RARITY_ICON_MAP, getSinnerLogoUrl, STORAGE_BASE, SIN_COLORS, SinType } from '@/lib/data/sinners'
import type { Sinner } from '@/lib/data/sinners'
import type { MetaData, IdentityStat } from '@/lib/db/meta'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useProgressiveRender } from '@/hooks/useProgressiveRender'
import { THEME_KEYWORDS } from '@/lib/constants/keywords'
import { mainKeywordColor, mainKeywords } from './metaConstants'
import KeywordBadge from './KeywordBadge'

const MAIN_KEYWORDS = new Set<string>(THEME_KEYWORDS)

type IdentitySubTab = 'battle' | 'support'

interface IdentityTabProps {
  data: MetaData
  totalDecks: number
  sinners: Sinner[]
  sinnerMap: Map<string, Sinner>
  sinnerFilter: string
  setSinnerFilter: (v: string | null) => void
  filteredStats: IdentityStat[]
  label: string
  subTab: IdentitySubTab
  setSubTab: (v: IdentitySubTab) => void
}

export default function IdentityTab({
  data,
  totalDecks,
  sinners,
  sinnerMap,
  sinnerFilter,
  setSinnerFilter,
  filteredStats,
  label,
  subTab,
  setSubTab,
}: IdentityTabProps) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const maxCount = filteredStats[0]?.count || 1
  const { visible, sentinelRef } = useProgressiveRender(filteredStats.length)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 좌: 랭킹 */}
      <div className="lg:col-span-2">
        {/* 배틀/서포트 서브탭 */}
        <div className="flex gap-2 mb-4">
          {([
            { key: 'battle' as IdentitySubTab, label: '배틀' },
            { key: 'support' as IdentitySubTab, label: '서포트' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className="px-4 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: subTab === t.key
                  ? (t.key === 'battle' ? 'rgba(200,48,64,0.15)' : 'rgba(72,120,160,0.15)')
                  : 'rgba(255,255,255,0.05)',
                color: subTab === t.key
                  ? (t.key === 'battle' ? '#e05060' : '#4898b0')
                  : '#666688',
                border: `1px solid ${subTab === t.key
                  ? (t.key === 'battle' ? 'rgba(200,48,64,0.4)' : 'rgba(72,120,160,0.4)')
                  : 'transparent'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 수감자 필터 */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setSinnerFilter(null)}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: !sinnerFilter ? 'var(--gold)' : 'rgba(255,255,255,0.05)',
              color: !sinnerFilter ? 'var(--bg-deep)' : '#666688',
            }}
          >
            전체
          </button>
          {sinners.map(s => (
            <button
              key={s.id}
              onClick={() => setSinnerFilter(sinnerFilter === s.id ? null : s.id)}
              className="relative w-8 h-8 rounded-full overflow-hidden transition-all"
              title={s.name_kr}
              style={{
                border: sinnerFilter === s.id ? '2px solid var(--gold)' : '2px solid transparent',
                opacity: sinnerFilter && sinnerFilter !== s.id ? 0.35 : 1,
              }}
            >
              <Image src={getSinnerLogoUrl(s.id)} alt={s.name_kr} fill className="object-contain" sizes="60px" />
            </button>
          ))}
        </div>

        <h2 className="font-serif text-xl font-semibold mb-5" style={{ color: 'var(--gold-light)' }}>
          {sinnerFilter
            ? `${sinnerMap.get(sinnerFilter)?.name_kr ?? ''} ${label}`
            : `${label} TOP 20`}
        </h2>

        <div className="usage-chart space-y-2">
          {filteredStats.slice(0, visible).map((stat, i) => {
            const pct = (stat.count / maxCount) * 100
            const rate = ((stat.count / totalDecks) * 100).toFixed(1)
            const color = mainKeywordColor(stat.keywords, kwSinMap)
            const sName = sinnerMap.get(stat.sinner_id)?.name_kr ?? ''
            const kws = mainKeywords(stat.keywords, kwSinMap)
            const rarityWidth = stat.rarity === 3 ? 36 : stat.rarity === 2 ? 26 : 16

            return (
              <div
                key={stat.identity_id}
                className="rounded-lg p-3 transition-colors"
                style={{
                  background: 'rgba(26,21,16,0.6)',
                  border: i < 3 ? `1px solid ${color}30` : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  {/* 순위 */}
                  <span
                    className="font-mono text-sm w-6 text-center font-bold"
                    style={{
                      color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#555566',
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* 초상화 */}
                  {stat.folder_name && stat.game_id ? (
                    <div className="relative overflow-hidden shrink-0" style={{ width: '2.25rem', height: '3rem', borderRadius: '0.25rem', background: '#0a0806', border: `1px solid ${i < 3 ? color + '40' : 'rgba(58,42,21,0.4)'}` }}>
                      <Image
                        src={`${STORAGE_BASE}/sinners/${stat.sinner_id}/identities/${encodeURIComponent(stat.folder_name)}/${stat.game_id}_normal_info.webp`}
                        alt=""
                        fill
                        sizes="36px"
                        quality={50}
                        style={{ objectFit: 'cover', objectPosition: 'center top' }}
                      />
                    </div>
                  ) : (
                    <div style={{ width: '2.25rem', height: '3rem', borderRadius: '0.25rem', background: '#0a0806', border: '1px solid rgba(58,42,21,0.4)' }} />
                  )}

                  {/* 등급 + 인격명 + 수감자 */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {RARITY_ICON_MAP[stat.rarity] && (
                        <Image
                          src={RARITY_ICON_MAP[stat.rarity]}
                          alt={`${stat.rarity}성`}
                          width={rarityWidth}
                          height={14}
                          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}
                        />
                      )}
                      <span className="text-xs shrink-0" style={{ color: '#888888' }}>{sName}</span>
                    </div>
                    <span className="text-sm font-medium truncate" style={{ color: '#e8e4d8' }}>
                      {stat.name_kr}
                    </span>
                  </div>

                  {/* 채용률 + 카운트 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs" style={{ color: '#666688' }}>{rate}%</span>
                    <span
                      className="count-up font-mono text-sm font-bold"
                      data-target={stat.count}
                      style={{ color, minWidth: '1.5rem', textAlign: 'right' }}
                    >
                      {stat.count}
                    </span>
                  </div>
                </div>

                {/* 키워드 배지 + 바 */}
                <div className="flex items-center gap-3">
                  <div className="w-6" />
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="usage-bar h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(to right, ${color}60, ${color})`,
                        }}
                      />
                    </div>
                    {kws.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {kws.map(kw => <KeywordBadge key={kw} keyword={kw} />)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {filteredStats.length === 0 && (
            <p className="text-center py-12" style={{ color: '#888888' }}>데이터가 없습니다</p>
          )}
          <div ref={sentinelRef} />
        </div>
      </div>

      {/* 우: 키워드 분포 */}
      <div>
        <h2 className="font-serif text-xl font-semibold mb-5" style={{ color: 'var(--gold-light)' }}>
          키워드 분포
        </h2>
        <div className="card p-5 space-y-4">
          {(() => {
            const filtered = data.keywordUsage.filter(k => MAIN_KEYWORDS.has(k.keyword))
            const maxKw = filtered[0]?.count || 1
            return filtered.slice(0, 10).map(kw => {
              const pct = (kw.count / maxKw) * 100
              const sin = kwSinMap[kw.keyword]
              const resolvedColor = sin ? SIN_COLORS[sin as SinType] : '#888'
              const iconUrl = getIconUrl(kw.keyword)
              return (
                <div key={kw.keyword}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                      style={{ background: `${resolvedColor}15`, border: `1px solid ${resolvedColor}30` }}
                    >
                      {iconUrl && (
                        <Image src={iconUrl} alt="" width={14} height={14} unoptimized />
                      )}
                    </div>
                    <span className="flex-1 text-xs" style={{ color: '#e8e4d8' }}>{kw.keyword}</span>
                    <span className="font-mono text-xs font-bold" style={{ color: resolvedColor }}>{kw.count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div
                      className="usage-bar h-full rounded-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(to right, ${resolvedColor}80, ${resolvedColor})` }}
                    />
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}
