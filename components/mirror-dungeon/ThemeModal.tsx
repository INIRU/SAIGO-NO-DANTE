'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import GiftCard from '@/components/mirror-dungeon/GiftCard'
import type { EgoGift, EgoGiftTheme } from '@/components/mirror-dungeon/types'

interface ThemeModalProps {
  theme: EgoGiftTheme
  themeGifts: EgoGift[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
}

export default function ThemeModal({
  theme,
  themeGifts,
  getGiftKeywordIcon,
  onClose,
  onSelectGift,
}: ThemeModalProps) {
  const specificIds = new Set(theme.specific_ego_gift_ids)
  const exclusiveGifts = themeGifts.filter(g => g.game_id && specificIds.has(g.game_id))
  const sharedGifts = themeGifts.filter(g => !g.game_id || !specificIds.has(g.game_id))

  const byKeyword: Record<string, EgoGift[]> = {}
  for (const g of sharedGifts) {
    if (!byKeyword[g.keyword]) byKeyword[g.keyword] = []
    byKeyword[g.keyword].push(g)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl"
        style={{
          background: '#131110',
          border: '1px solid rgba(200,144,10,0.12)',
          boxShadow: '0 0 3rem rgba(200,144,10,0.08), 0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-colors hover:bg-white/10"
          style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
        >
          <X size={18} />
        </button>

        {/* 배너 헤더 */}
        <div className="relative overflow-hidden" style={{ height: theme.image_url ? '10rem' : '5rem' }}>
          {theme.image_url && (
            <>
              <ImageWithFallback
                src={theme.image_url}
                alt={theme.name}
                fill
                fallbackType="theme"
                sizes="(max-width: 768px) 100vw, 48rem"
                className="object-cover object-top"
                style={{ opacity: 0.4 }}
              />
              {theme.boss_image_url && (
                <div className="absolute right-0 bottom-0 z-10" style={{ width: '50%', aspectRatio: '391/432' }}>
                  <ImageWithFallback
                    src={theme.boss_image_url}
                    alt=""
                    fill
                    fallbackType="default"
                    sizes="200px"
                    className="object-contain object-bottom drop-shadow-lg"
                    style={{ opacity: 0.6 }}
                  />
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.6) 50%, rgba(19,17,16,0.3) 100%)' }}
              />
            </>
          )}
          {!theme.image_url && (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, rgba(200,144,10,0.05) 0%, transparent 100%)' }}
            />
          )}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
            <h3
              className="font-serif text-xl md:text-2xl font-bold"
              style={{ color: '#e8d8c0', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
            >
              {theme.name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {(() => {
                const diff = theme.difficulty || 'normal'
                const label = diff === 'extreme' ? '익스트림' : diff === 'hard' ? '하드' : '노말'
                const color = diff === 'extreme' ? '#e04040' : diff === 'hard' ? '#e89030' : '#999'
                const bg =
                  diff === 'extreme'
                    ? 'rgba(224,64,64,0.2)'
                    : diff === 'hard'
                    ? 'rgba(232,144,48,0.2)'
                    : 'rgba(255,255,255,0.08)'
                return (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold"
                    style={{ background: bg, color, fontFamily: 'var(--font-mono)' }}
                  >
                    {label}
                  </span>
                )
              })()}
              <span style={{ color: '#888', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                {themeGifts.length}종
              </span>
              {exclusiveGifts.length > 0 && (
                <span style={{ color: 'var(--gold)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                  ★{exclusiveGifts.length} 전용
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          {/* 출현 정보 + 키워드 분포 */}
          <div className="flex flex-wrap gap-4 mt-4 mb-5">
            {theme.floor_info && Object.keys(theme.floor_info).length > 0 && (
              <div className="flex-1 min-w-[14rem]">
                <p
                  className="text-[0.6875rem] font-bold mb-2"
                  style={{ color: '#666', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}
                >
                  출현 정보
                </p>
                <div className="space-y-1">
                  {Object.entries(theme.floor_info).map(([dungeon, floors]) => {
                    const dColor =
                      dungeon === '익스트림'
                        ? '#e04040'
                        : dungeon === '평행중첩'
                        ? '#b478dc'
                        : dungeon === '하드'
                        ? '#e89030'
                        : '#a0a090'
                    const floorText =
                      floors === '전체'
                        ? '전층'
                        : Array.isArray(floors)
                        ? floors.map(f => `${f}층`).join(', ')
                        : String(floors)
                    return (
                      <div key={dungeon} className="flex items-center gap-2">
                        <span
                          className="inline-block w-16 text-right"
                          style={{ color: dColor, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                        >
                          {dungeon}
                        </span>
                        <span style={{ color: '#555', fontSize: '0.8125rem' }}>—</span>
                        <span style={{ color: '#bbb', fontSize: '0.8125rem' }}>{floorText}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {/* 키워드 분포 */}
            <div className="flex-1 min-w-[10rem]">
              <p
                className="text-[0.6875rem] font-bold mb-2"
                style={{ color: '#666', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}
              >
                키워드 분포
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(byKeyword)
                  .sort((a, b) => b[1].length - a[1].length)
                  .slice(0, 6)
                  .map(([kw, kwGifts]) => {
                    const iconUrl = getGiftKeywordIcon(kw)
                    return (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {iconUrl && (
                          <Image
                            src={iconUrl}
                            alt={kw}
                            width={14}
                            height={14}
                            style={{ width: '0.875rem', height: '0.875rem' }}
                          />
                        )}
                        <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{kw}</span>
                        <span style={{ color: '#555', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                          {kwGifts.length}
                        </span>
                      </span>
                    )
                  })}
              </div>
            </div>
          </div>

          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, rgba(200,144,10,0.2), transparent 60%)',
              marginBottom: '1.25rem',
            }}
          />

          {/* 전용 기프트 */}
          {exclusiveGifts.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>★</span>
                <span className="font-serif font-medium" style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>
                  전용 기프트
                </span>
                <span style={{ color: '#666', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  ({exclusiveGifts.length})
                </span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(6.5rem, 1fr))' }}>
                {exclusiveGifts.map(g => (
                  <GiftCard key={g.id} gift={g} onClick={() => onSelectGift(g)} />
                ))}
              </div>
              <div
                className="mt-4"
                style={{ height: '1px', background: 'linear-gradient(90deg, var(--gold-dim), transparent)' }}
              />
            </div>
          )}

          {/* 키워드별 그룹 */}
          {Object.entries(byKeyword).map(([kw, kwGifts]) => {
            const iconUrl = getGiftKeywordIcon(kw)
            return (
              <div key={kw} className="mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  {iconUrl && (
                    <Image
                      src={iconUrl}
                      alt={kw}
                      width={16}
                      height={16}
                      style={{ width: '1rem', height: '1rem' }}
                    />
                  )}
                  <span
                    className="font-serif font-medium"
                    style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}
                  >
                    {kw}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({kwGifts.length})</span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(6.5rem, 1fr))' }}>
                  {kwGifts.map(g => (
                    <GiftCard key={g.id} gift={g} onClick={() => onSelectGift(g)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
