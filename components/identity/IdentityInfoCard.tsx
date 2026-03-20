'use client'

import Image from 'next/image'
import {
  Identity,
  SIN_COLORS,
  STORAGE_BASE,
  RARITY_ICON_MAP,
} from '@/lib/data/sinners'
import { KeywordWithTooltip } from '@/components/sinners/KeywordTooltip'
import { useKeywordData } from '@/components/providers/KeywordProvider'

interface IdentityInfoCardProps {
  identity: Identity
  sinColor: string
  currentSeason?: number
}

export default function IdentityInfoCard({ identity, sinColor, currentSeason = 7 }: IdentityInfoCardProps) {
  const { sinMap: kwSinMap } = useKeywordData()
  return (
    <div className="card p-6">
      <h2
        className="font-serif font-bold mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
        기본 정보
      </h2>

      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded"
        style={{
          background: 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        {/* 등급 */}
        <div className="flex items-center gap-2">
          {RARITY_ICON_MAP[identity.rarity] && (
            <Image
              src={RARITY_ICON_MAP[identity.rarity]}
              alt=""
              width={identity.rarity === 1 ? 16 : identity.rarity === 2 ? 28 : 40}
              height={16}
              style={{ width: identity.rarity === 1 ? '1rem' : identity.rarity === 2 ? '1.75rem' : '2.5rem', height: 'auto', filter: 'drop-shadow(0 0 3px rgba(200,144,10,0.4))' }}
            />
          )}
        </div>

        {/* 키워드 (메인 상태이상만) */}
        {identity.keywords && identity.keywords.filter(kw => kwSinMap[kw]).length > 0 && (
          <>
            <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
            <div className="flex items-center gap-2 flex-wrap">
              {identity.keywords.filter(kw => kwSinMap[kw]).map(kw => {
                const kwColor = SIN_COLORS[kwSinMap[kw]] || '#888'
                return (
                  <KeywordWithTooltip key={kw} keyword={kw}>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: kwColor }}
                    >
                      {kw}
                    </span>
                  </KeywordWithTooltip>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 내성 */}
      {(identity.slash_res || identity.pierce_res || identity.blunt_res) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          {([
            { label: '참격', res: identity.slash_res, icon: 'slash' },
            { label: '관통', res: identity.pierce_res, icon: 'pierce' },
            { label: '타격', res: identity.blunt_res, icon: 'blunt' },
          ] as const).map(({ label, res, icon }) => {
            const resColor = res === '취약' ? '#ff6b6b' : res === '내성' ? '#6bbbff' : '#888'
            return (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
              >
                <Image
                  src={`${STORAGE_BASE}/icons/stats/${icon}.webp`}
                  alt=""
                  width={14}
                  height={14}
                  style={{ width: '0.875rem', height: '0.875rem' }}
                />
                <span style={{ color: resColor, fontSize: '0.6875rem', fontWeight: 600 }}>
                  {res}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 소속 */}
      {identity.affiliation && (
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div style={{ color: '#999', fontSize: '0.75rem', marginBottom: '6px' }}>소속</div>
          <span
            className="px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1"
            style={{
              background: `${sinColor}18`,
              color: sinColor,
              border: `1px solid ${sinColor}40`,
            }}
          >
            {identity.affiliation}
          </span>
        </div>
      )}

      {/* 출시시기 & 획득 방법 */}
      {(identity.release_date || identity.acquisition_info) && (
        <div className="mt-5 space-y-2">
          {identity.release_date && (
            <div className="flex items-center gap-2">
              <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>출시시기</span>
              <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{identity.release_date}</span>
            </div>
          )}
          {(() => {
            const info = identity.acquisition_info
            if (!info) return null

            const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
              default:    { label: '기본',      color: '#8a8a8a', bg: 'rgba(138,138,138,0.12)' },
              standard:   { label: '추출',      color: '#6bbbff', bg: 'rgba(107,187,255,0.12)' },
              event:      { label: '이벤트',    color: '#ff9f43', bg: 'rgba(255,159,67,0.12)' },
              walpurgis:  { label: '발푸르기스', color: '#7bed9f', bg: 'rgba(123,237,159,0.12)' },
              attendance: { label: '출석',      color: '#a29bfe', bg: 'rgba(162,155,254,0.12)' },
            }
            const GACHA_LABELS: Record<string, { label: string; color: string }> = {
              always:   { label: '상시 추출',   color: '#6bbbff' },
              seasonal: { label: '시즌 한정',   color: '#ffa502' },
              walpurgis:{ label: '발푸밤 한정', color: '#7bed9f' },
              none:     { label: '추출 불가',   color: '#999' },
            }

            const typeInfo = TYPE_LABELS[info.type] ?? TYPE_LABELS.standard
            const gachaInfo = GACHA_LABELS[info.gacha] ?? GACHA_LABELS.none

            return (
              <div className="space-y-2">
                {/* 타입 + 시즌 배지 */}
                <div className="flex items-center gap-2">
                  <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>획득 방법</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* 타입 배지 */}
                    <span
                      style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        padding: '2px 8px', borderRadius: '3px',
                        color: typeInfo.color,
                        background: typeInfo.bg,
                        border: `1px solid ${typeInfo.color}30`,
                      }}
                    >
                      {typeInfo.label}
                    </span>

                    {/* 시즌 */}
                    {info.release_season > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: '#c8900a',
                          background: 'rgba(200,144,10,0.1)',
                          border: '1px solid rgba(200,144,10,0.2)',
                        }}
                      >
                        시즌 {info.release_season}
                      </span>
                    )}

                    {/* 발푸밤 회차 */}
                    {info.walpurgis_edition && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: '#7bed9f',
                          background: 'rgba(123,237,159,0.08)',
                          border: '1px solid rgba(123,237,159,0.2)',
                        }}
                      >
                        {info.walpurgis_edition}회차
                      </span>
                    )}

                    {/* 이벤트명 */}
                    {info.event_name && (
                      <span
                        style={{
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 8px', borderRadius: '3px',
                          color: '#ff9f43',
                          background: 'rgba(255,159,67,0.08)',
                          border: '1px solid rgba(255,159,67,0.2)',
                        }}
                      >
                        {info.event_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 추출 상태 */}
                {info.type !== 'default' && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>추출</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ fontSize: '0.75rem', color: gachaInfo.color }}>
                        {gachaInfo.label}
                        {info.gacha === 'seasonal' && info.gacha_from_season && ` (S${info.gacha_from_season}~)`}
                      </span>
                      {info.target_sinner && (
                        <span style={{ fontSize: '0.75rem', color: '#ffa502' }}>
                          · {info.target_sinner} 특정 추출
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 자판기 교환 */}
                {(info.gacha === 'seasonal' || (info.type === 'event' && info.gacha === 'none')) && (() => {
                  const releaseSeason = Number(info.release_season ?? 0)
                  const diff = currentSeason - releaseSeason
                  const available = diff !== 1
                  return (
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>자판기</span>
                      <span style={{ fontSize: '0.75rem', color: available ? '#7bed9f' : '#ff6b6b' }}>
                        {available ? '교환 가능' : '교환 불가 (다음 시즌부터 가능)'}
                      </span>
                    </div>
                  )
                })()}

                {/* 파편 교환 */}
                {info.fragment_cost && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#999', fontSize: '0.75rem', minWidth: '52px' }}>파편 교환</span>
                    <span style={{ fontSize: '0.75rem', color: '#bbb' }}>
                      자아 파편 {info.fragment_cost}
                      {info.exchange_from_season
                        ? ` (S${info.exchange_from_season}~ 상시)`
                        : info.gacha === 'always' ? ' (상시)' : ''
                      }
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
