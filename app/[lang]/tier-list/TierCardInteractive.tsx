'use client'

import Image from 'next/image'
import { getIdentityInfoUrl, RARITY_ICON_MAP, type Identity } from '@/lib/data/sinners'
import { useSelection } from './SelectionContext'

type AcquisitionInfo = {
  type: string
  gacha: string
  [key: string]: unknown
}

export type TierIdentity = Pick<Identity, 'id' | 'name_kr' | 'rarity' | 'sinner_id' | 'game_id' | 'folder_name'> & {
  acquisition_info?: AcquisitionInfo | null
  release_date?: string | null
}

export function getAcquisitionBar(
  info: AcquisitionInfo | null | undefined,
  releaseDate: string | null | undefined,
  currentSeason: number,
): { color: string; label: string } | null {
  if (!info) return null
  if (info.gacha === 'walpurgis') return { color: '#60c860', label: '발푸르기스 밤' }
  if (info.gacha === 'seasonal') {
    const releaseSeason = Number(info.release_season ?? 0)
    const diff = currentSeason - releaseSeason

    if (diff === 0 && releaseDate) {
      const daysSince = Math.floor((Date.now() - new Date(releaseDate).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince < 7) return { color: '#ffd040', label: '자판기 교환 불가 (추출 가능)' }
      return null
    }

    if (diff === 1) return { color: '#ffd040', label: '추출만 가능' }
    return null
  }
  if (info.type === 'event' && info.gacha === 'none') {
    const releaseSeason = Number(info.release_season ?? 0)
    const diff = currentSeason - releaseSeason
    if (diff === 1) return { color: '#ffd040', label: '자판기 교환 불가' }
    return null
  }
  return null
}

export default function TierCardInteractive({
  identity,
  currentSeason,
}: {
  identity: TierIdentity
  currentSeason: number
}) {
  const { selected, toggleSelect } = useSelection()
  const isSelected = selected.has(identity.id)
  const imgUrl = getIdentityInfoUrl(identity as Identity)
  const rarityIcon = RARITY_ICON_MAP[identity.rarity]
  const bar = getAcquisitionBar(identity.acquisition_info, identity.release_date, currentSeason)

  return (
    <button
      onClick={() => toggleSelect(identity.id)}
      style={{
        background: '#1a1510',
        border: isSelected ? '2px solid var(--gold)' : '1px solid var(--border)',
        borderRadius: '0.375rem',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: isSelected ? '0 0 0.75rem rgba(200,144,10,0.2)' : 'none',
      }}
    >
      {/* 선택 체크 */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '0.3125rem',
            left: '0.3125rem',
            zIndex: 2,
            width: '1.625rem',
            height: '1.625rem',
            borderRadius: '0.375rem',
            background: 'var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0.125rem 0.375rem rgba(0,0,0,0.5)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d0b08" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* 일러스트 */}
      <div style={{ position: 'relative', aspectRatio: '3/4', background: '#12100d', overflow: 'hidden' }}>
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={identity.name_kr}
            width={220}
            height={293}
            quality={40}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#3a3028', fontSize: '0.75rem' }}>No Image</span>
          </div>
        )}
        {/* 등급 아이콘 */}
        {rarityIcon && (
          <div style={{ position: 'absolute', top: '0.25rem', right: '0.25rem' }}>
            <Image src={rarityIcon} alt={`${identity.rarity}성`} width={18} height={18} unoptimized />
          </div>
        )}
      </div>

      {/* 이름 */}
      <div style={{ padding: '0.375rem 0.375rem 0.25rem', textAlign: 'center' }}>
        <p style={{
          fontSize: '0.6875rem',
          color: isSelected ? 'var(--gold)' : '#c8a450',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
          fontWeight: isSelected ? 600 : 400,
        }}>
          {identity.name_kr}
        </p>
      </div>

      {/* 획득 경로 바 */}
      {bar && (
        <div
          style={{
            height: '0.25rem',
            background: bar.color,
            borderRadius: '0 0 0.25rem 0.25rem',
          }}
          title={bar.label}
        />
      )}
    </button>
  )
}
