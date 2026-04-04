'use client'

import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type { EgoGift, MirrorDungeonEvent } from '@/components/mirror-dungeon/types'

interface EventTabProps {
  events: MirrorDungeonEvent[]
  giftByGameId: Map<number, EgoGift>
  eventSearch: string
  setEventSearch: (v: string) => void
  onSelectEvent: (event: MirrorDungeonEvent) => void
}

export default function EventTab({
  events,
  giftByGameId,
  eventSearch,
  setEventSearch,
  onSelectEvent,
}: EventTabProps) {
  const { rootEvents, filteredEvents, totalCount } = useMemo(() => {
    const seen = new Set<string>()
    const roots = events.filter(ev => {
      if (ev.parent_id) return false
      const key = ev.desc_text || String(ev.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const q = eventSearch.trim().toLowerCase()
    const filtered = q
      ? roots.filter(ev => {
          if (ev.name?.toLowerCase().includes(q) || ev.desc_text?.toLowerCase().includes(q)) return true
          if (ev.options?.some(o => o.message?.toLowerCase().includes(q) || o.messageDesc?.toLowerCase().includes(q)))
            return true
          if (ev.gift_ids?.some(gid => {
            const g = giftByGameId.get(gid)
            return g && g.name.toLowerCase().includes(q)
          }))
            return true
          return false
        })
      : roots

    return { rootEvents: roots, filteredEvents: filtered, totalCount: roots.length }
  }, [events, eventSearch, giftByGameId])

  return (
    <>
      {/* 검색 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-[20rem]">
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.625rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#555',
            }}
          />
          <input
            type="text"
            placeholder="이벤트 · 기프트 검색..."
            value={eventSearch}
            onChange={e => setEventSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 rounded text-xs"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ccc',
              outline: 'none',
              fontFamily: 'var(--font-heading)',
            }}
          />
          {eventSearch && (
            <button
              onClick={() => setEventSearch('')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#555',
                cursor: 'pointer',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
          {eventSearch ? `${filteredEvents.length}건` : `${totalCount}건`}
        </span>
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-8">
        {filteredEvents.map(ev => {
          const evGifts = (ev.gift_ids || []).map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]
          const childCount = events.filter(c => c.parent_id === ev.id).length
          return (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(ev)}
              className="group text-left overflow-hidden transition-all duration-200"
              style={{
                background: '#1a1714',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(200,144,10,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              }}
            >
              {ev.image_url ? (
                <div className="relative w-full aspect-square overflow-hidden">
                  <ImageWithFallback
                    src={ev.image_url}
                    alt=""
                    fill
                    fallbackType="default"
                    sizes="(max-width: 640px) 50vw, 20vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    style={{ opacity: 0.8 }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.9) 0%, transparent 60%)' }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
                    <p
                      className="font-serif font-medium leading-tight line-clamp-2"
                      style={{ color: '#e8d8c0', fontSize: '0.75rem', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
                    >
                      {ev.desc_text ? ev.desc_text.split('\n')[0].slice(0, 30) : `이벤트 #${ev.id}`}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {evGifts.length > 0 && (
                        <span style={{ color: 'var(--gold)', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                          {evGifts.length}종
                        </span>
                      )}
                      {ev.options && (
                        <span style={{ color: '#888', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                          선택지 {ev.options.length}
                        </span>
                      )}
                      {childCount > 0 && (
                        <span style={{ color: '#a08860', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                          +{childCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-3">
                  <p
                    className="font-serif font-medium leading-tight line-clamp-2 mb-1.5"
                    style={{ color: '#ccc', fontSize: '0.75rem' }}
                  >
                    {ev.desc_text ? ev.desc_text.split('\n')[0].slice(0, 40) : `이벤트 #${ev.id}`}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {evGifts.length > 0 && (
                      <span style={{ color: 'var(--gold)', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                        {evGifts.length}종
                      </span>
                    )}
                    {ev.options && (
                      <span style={{ color: '#888', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)' }}>
                        선택지 {ev.options.length}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}
