'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, Plus, Search } from 'lucide-react'
import type { GiftData } from '@/lib/planner/types'

interface GiftInventoryProps {
  inventory: string[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}

export default function GiftInventory({ inventory, gifts, giftMap, onAdd, onRemove }: GiftInventoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const inventoryGifts = inventory
    .map(id => gifts.find(g => String(g.game_id) === id))
    .filter(Boolean) as GiftData[]

  const suggestions = searchQuery.trim().length > 0
    ? gifts
        .filter(g =>
          g.name.includes(searchQuery) &&
          !inventory.includes(String(g.game_id))
        )
        .slice(0, 8)
    : []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleAdd(gift: GiftData) {
    onAdd(String(gift.game_id))
    setSearchQuery('')
    setShowSuggestions(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
          기프트 인벤토리
        </span>
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--gold)',
          background: 'rgba(200,144,10,0.12)',
          padding: '0.125rem 0.5rem',
          borderRadius: '0.25rem',
          border: '1px solid rgba(200,144,10,0.3)',
        }}>
          {inventory.length}개
        </span>
      </div>

      {/* Search / Add */}
      <div ref={searchRef} style={{ position: 'relative' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--bg-card)',
          border: '1px solid #333',
          borderRadius: '0.375rem',
          padding: '0.375rem 0.625rem',
        }}>
          <Search size={14} color="#6b7280" />
          <input
            type="text"
            placeholder="기프트 추가..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.8125rem',
              color: '#e5e7eb',
            }}
          />
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 0.25rem)',
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            zIndex: 50,
            maxHeight: '14rem',
            overflowY: 'auto',
          }}>
            {suggestions.map(gift => (
              <button
                key={gift.id}
                onClick={() => handleAdd(gift)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.625rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#e5e7eb',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {gift.image_url ? (
                  <Image
                    src={gift.image_url}
                    alt={gift.name}
                    width={28}
                    height={28}
                    style={{ width: '1.75rem', height: '1.75rem', objectFit: 'contain', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: '1.75rem',
                    height: '1.75rem',
                    background: '#222',
                    borderRadius: '0.25rem',
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ fontSize: '0.8125rem', flex: 1 }}>{gift.name}</span>
                {gift.keyword && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--gold-dim)' }}>{gift.keyword}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gift grid */}
      {inventoryGifts.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          border: '1px dashed #222',
          borderRadius: '0.5rem',
        }}>
          기프트를 추가해주세요
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))',
          gap: '0.5rem',
        }}>
          {inventoryGifts.map(gift => (
            <div
              key={gift.id}
              style={{
                contentVisibility: 'auto',
                contain: 'layout style paint',
                containIntrinsicSize: '5rem',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  background: 'var(--bg-card)',
                  border: '1px solid #222',
                  borderRadius: '0.375rem',
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                {gift.image_url ? (
                  <Image
                    src={gift.image_url}
                    alt={gift.name}
                    width={48}
                    height={48}
                    style={{ width: '3rem', height: '3rem', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ width: '3rem', height: '3rem', background: '#222', borderRadius: '0.25rem' }} />
                )}
                <span style={{
                  fontSize: '0.6rem',
                  color: '#9ca3af',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  wordBreak: 'keep-all',
                  maxWidth: '100%',
                }}>
                  {gift.name}
                </span>
                <button
                  onClick={() => onRemove(String(gift.game_id))}
                  style={{
                    position: 'absolute',
                    top: '0.125rem',
                    right: '0.125rem',
                    background: 'rgba(220,38,38,0.8)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '1rem',
                    height: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title="제거"
                >
                  <X size={10} color="#fff" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
