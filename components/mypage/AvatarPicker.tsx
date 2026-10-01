'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Camera } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { STORAGE_BASE } from '@/lib/constants/game'
import { BLUR_PLACEHOLDER, getIdentityImageUrl } from '@/lib/utils/images'
import { getBlurDataURL } from '@/lib/utils/thumbhash'

type Sinner = { id: string; name_kr: string; order_num: number }
type AvatarIdentity = {
  sinner_id: string
  name_kr: string
  folder_name: string
  game_id: string
  rarity: number
}

interface Props {
  open: boolean
  currentUrl: string | null
  onSelect: (url: string) => void
  onReset: () => void
  onClose: () => void
}

export default function AvatarPicker({ open, currentUrl, onSelect, onReset, onClose }: Props) {
  const [sinners, setSinners] = useState<Sinner[]>([])
  const [identities, setIdentities] = useState<AvatarIdentity[]>([])
  const [selectedSinner, setSelectedSinner] = useState<string>('')
  const [gacksung, setGacksung] = useState(true)
  const [loading, setLoading] = useState(true)
  const [failedGacksung, setFailedGacksung] = useState<Set<string>>(new Set())
  const [failedProfile, setFailedProfile] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/identities/avatars')
      .then(r => r.json())
      .then(data => {
        setSinners(data.sinners)
        setIdentities(data.identities)
        if (data.sinners.length > 0) setSelectedSinner(data.sinners[0].id)
      })
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const filtered = identities.filter(i => i.sinner_id === selectedSinner)

  const getUrl = (identity: AvatarIdentity, forceNormal = false) => {
    const useGacksung = gacksung && !forceNormal && !failedGacksung.has(identity.game_id)
    const base = useGacksung ? 'gacksung' : 'normal'
    const suffix = failedProfile.has(`${identity.game_id}_${base}`) ? '' : '_profile'
    return getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_${base}${suffix}`)
  }

  return (
    <BaseModal open={open} onClose={onClose} maxWidth="42rem" title="아바타 선택">
      <div
        className="relative w-full max-h-[80vh] flex flex-col"
        style={{
          background: '#1a1510',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        }}
      >
        {/* 상단 골드 라인 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
        }} />

        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1rem' }}>
            프로필 사진 선택
          </h3>
          <div className="flex items-center gap-3">
            {/* 기본/각성 토글 */}
            <button
              onClick={() => setGacksung(!gacksung)}
              className="text-xs px-3 py-1.5 rounded transition-colors"
              style={{
                color: gacksung ? 'var(--gold)' : '#888',
                border: `1px solid ${gacksung ? 'var(--gold-dim)' : 'var(--border)'}`,
                background: gacksung ? 'rgba(200,144,10,0.1)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {gacksung ? '동기화' : '기본'}
            </button>
            {/* 초기화 */}
            {currentUrl && (
              <button
                onClick={onReset}
                className="text-xs px-3 py-1.5 rounded transition-colors"
                style={{
                  color: '#999',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                기본으로
              </button>
            )}
            <button onClick={onClose} aria-label="닫기" style={{ color: '#999', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 수감자 탭 */}
        <div
          className="flex gap-1.5 px-4 py-3 overflow-x-auto"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {sinners.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSinner(s.id)}
              className="flex flex-shrink-0 items-center justify-center transition duration-150 focus-visible:outline-none focus-visible:ring-[0.125rem] focus-visible:ring-[var(--gold)] focus-visible:ring-offset-[0.125rem] focus-visible:ring-offset-[#1a1510]"
              title={s.name_kr}
              aria-pressed={selectedSinner === s.id}
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '50%',
                border: selectedSinner === s.id ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
                background: selectedSinner === s.id ? 'rgba(200,144,10,0.15)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                overflow: 'hidden',
                padding: '0.25rem',
              }}
            >
              <Image
                src={`${STORAGE_BASE}/icons/Sinners/${s.id}.webp`}
                alt={s.name_kr}
                width={28}
                height={28}
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: '50%',
                }}
              />
            </button>
          ))}
        </div>

        {/* 인격 그리드 */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1',
                    background: '#2a2015',
                    borderRadius: 8,
                    opacity: 0.4 + (i % 3) * 0.1,
                  }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
              인격이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {filtered.map(identity => {
                const url = getUrl(identity)
                const isSelected = url === currentUrl
                return (
                  <button
                    key={identity.game_id}
                    onClick={() => onSelect(url)}
                    className="relative group transition duration-150"
                    style={{
                      aspectRatio: '1',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: isSelected
                        ? '2px solid var(--gold)'
                        : '2px solid rgba(58,42,21,0.3)',
                      boxShadow: isSelected
                        ? '0 0 12px rgba(200,144,10,0.3)'
                        : 'none',
                      cursor: 'pointer',
                      background: '#120e09',
                    }}
                  >
                    <Image
                      src={url}
                      alt={identity.name_kr ?? ''}
                      fill
                      sizes="100px"
                      placeholder="blur"
                      blurDataURL={getBlurDataURL(url) ?? BLUR_PLACEHOLDER}
                      style={{ objectFit: 'cover' }}
                      onError={() => {
                        const base = gacksung && !failedGacksung.has(identity.game_id) ? 'gacksung' : 'normal'
                        const profileKey = `${identity.game_id}_${base}`
                        if (!failedProfile.has(profileKey)) {
                          setFailedProfile(prev => new Set(prev).add(profileKey))
                        } else if (gacksung && !failedGacksung.has(identity.game_id)) {
                          setFailedGacksung(prev => new Set(prev).add(identity.game_id))
                        }
                      }}
                    />
                    {/* 호버 오버레이 */}
                    <div
                      className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                        padding: '1rem 0.25rem 0.375rem',
                      }}
                    >
                      <p
                        className="text-center"
                        style={{
                          color: '#e8dcc8',
                          fontSize: '0.75rem',
                          lineHeight: 1.3,
                        }}
                      >
                        {identity.name_kr}
                      </p>
                    </div>
                    {/* 선택 표시 */}
                    {isSelected && (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: 'rgba(200,144,10,0.2)' }}
                      >
                        <div
                          style={{
                            width: '1.5rem',
                            height: '1.5rem',
                            borderRadius: '50%',
                            background: 'var(--gold)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0d0b08',
                            fontWeight: 'bold',
                            fontSize: '0.875rem',
                          }}
                        >
                          ✓
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  )
}

/** 아바타 편집 오버레이 버튼 */
export function AvatarEditOverlay({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
      style={{
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.55)',
        cursor: 'pointer',
      }}
    >
      <Camera size={20} style={{ color: 'var(--gold)' }} />
    </button>
  )
}
