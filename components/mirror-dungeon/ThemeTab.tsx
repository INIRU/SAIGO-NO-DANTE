'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import ThemePackCard from '@/components/mirror-dungeon/ThemePackCard'
import type { EgoGift, EgoGiftTheme } from '@/components/mirror-dungeon/types'

const FLOOR_OFFSET: Record<string, number> = { '노말': 0, '하드': 0, '평행중첩': 5, '익스트림': 10 }
const FLOOR_RANGE: Record<string, [number, number]> = {
  '노말': [1, 5],
  '하드': [1, 5],
  '평행중첩': [6, 10],
  '익스트림': [11, 15],
}

interface ThemeTabProps {
  themes: EgoGiftTheme[]
  gifts: EgoGift[]
  giftByGameId: Map<number, EgoGift>
  themeSearch: string
  themeDiffFilter: string
  setThemeSearch: (v: string) => void
  setThemeDiffFilter: (v: string) => void
  onThemeClick: (id: number) => void
}

export default function ThemeTab({
  themes,
  gifts,
  giftByGameId,
  themeSearch,
  themeDiffFilter,
  setThemeSearch,
  setThemeDiffFilter,
  onThemeClick,
}: ThemeTabProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  const themeSearchSuggestions = useMemo(() => {
    if (!themeSearch.trim() || themeSearch.trim().length < 1) return []
    const q = themeSearch.trim().toLowerCase()
    const suggestions: Array<{ type: 'theme' | 'gift'; label: string; sub?: string }> = []
    for (const t of themes) {
      if (t.name.toLowerCase().includes(q)) {
        const diff = t.difficulty === 'hard' ? ' [하드]' : t.difficulty === 'extreme' ? ' [익스트림]' : ''
        suggestions.push({ type: 'theme', label: t.name, sub: diff })
      }
      if (suggestions.length >= 8) break
    }
    if (suggestions.length < 8) {
      const seen = new Set<string>()
      for (const g of gifts) {
        if (g.name.toLowerCase().includes(q) && !seen.has(g.name)) {
          seen.add(g.name)
          const belongThemes = themes.filter(t => g.game_id && t.ego_gift_ids.includes(g.game_id))
          if (belongThemes.length > 0) {
            suggestions.push({ type: 'gift', label: g.name, sub: `${belongThemes.length}개 테마팩` })
          }
          if (suggestions.length >= 8) break
        }
      }
    }
    return suggestions
  }, [themeSearch, themes, gifts])

  const filteredThemes = useMemo(() => {
    let result = themes
    if (themeDiffFilter !== '전체') {
      const diffMap: Record<string, string> = { '노말': 'normal', '하드': 'hard', '익스트림': 'extreme' }
      result = result.filter(t => t.difficulty === diffMap[themeDiffFilter])
    }
    if (themeSearch.trim()) {
      const q = themeSearch.trim().toLowerCase()
      result = result.filter(t => {
        if (t.name.toLowerCase().includes(q)) return true
        return t.ego_gift_ids.some(gid => {
          const g = giftByGameId.get(gid)
          return g && g.name.toLowerCase().includes(q)
        })
      })
    }
    return result
  }, [themes, themeSearch, themeDiffFilter, giftByGameId])

  const floorGroupedThemes = useMemo(() => {
    const floorKeys: string[] =
      themeDiffFilter === '전체'
        ? ['노말', '하드', '평행중첩', '익스트림']
        : themeDiffFilter === '하드'
        ? ['하드', '평행중첩']
        : [themeDiffFilter]

    const floorMap = new Map<number, EgoGiftTheme[]>()

    function addToFloor(floor: number, theme: EgoGiftTheme) {
      const arr: EgoGiftTheme[] = floorMap.get(floor) ?? []
      if (!arr.includes(theme)) arr.push(theme)
      floorMap.set(floor, arr)
    }

    for (const theme of filteredThemes) {
      if (!theme.floor_info) continue
      for (const key of floorKeys) {
        const floors: number[] | string | undefined = theme.floor_info[key]
        if (!floors) continue
        const offset = FLOOR_OFFSET[key] ?? 0
        if (Array.isArray(floors)) {
          for (const f of floors as number[]) addToFloor(f + offset, theme)
        } else if (floors === '전체') {
          const range = FLOOR_RANGE[key]
          if (range) {
            for (let f = range[0]; f <= range[1]; f++) addToFloor(f, theme)
          }
        }
      }
    }

    const unassigned = filteredThemes.filter(t => {
      if (!t.floor_info) return true
      return !floorKeys.some(k => t.floor_info?.[k])
    })

    const sorted = [...floorMap.entries()].sort((a, b) => a[0] - b[0])
    const merged: [number, number, EgoGiftTheme[]][] = []
    for (const [floor, floorThemes] of sorted) {
      const ids = new Set(floorThemes.map(t => t.id))
      const prev = merged[merged.length - 1]
      if (prev && floor === prev[1] + 1) {
        const prevIds = new Set(prev[2].map(t => t.id))
        if (ids.size === prevIds.size && [...ids].every(id => prevIds.has(id))) {
          prev[1] = floor
          continue
        }
      }
      merged.push([floor, floor, floorThemes])
    }
    if (unassigned.length > 0) merged.push([0, 0, unassigned])
    return merged.length > 0 ? merged : null
  }, [filteredThemes, themeDiffFilter])

  return (
    <>
      {/* 검색 + 난이도 필터 */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-[12rem] max-w-[20rem]">
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
            placeholder="테마팩 · 기프트 검색..."
            value={themeSearch}
            onChange={e => setThemeSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className="w-full pl-8 pr-8 py-1.5 rounded text-xs"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ccc',
              outline: 'none',
              fontFamily: 'var(--font-heading)',
            }}
          />
          {themeSearch && (
            <button
              onClick={() => setThemeSearch('')}
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
          {/* 자동완성 */}
          {searchFocused && themeSearchSuggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50"
              style={{
                background: '#1a1510',
                border: '1px solid rgba(200,144,10,0.2)',
                boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.5)',
              }}
            >
              {themeSearchSuggestions.map((s, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors hover:bg-white/5"
                  style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseDown={() => setThemeSearch(s.label)}
                >
                  <span
                    style={{
                      color: s.type === 'theme' ? 'var(--gold)' : '#888',
                      fontSize: '0.5625rem',
                      fontFamily: 'var(--font-mono)',
                      width: '2rem',
                    }}
                  >
                    {s.type === 'theme' ? '테마팩' : '기프트'}
                  </span>
                  <span style={{ color: '#ccc', fontSize: '0.75rem' }}>{s.label}</span>
                  {s.sub && (
                    <span style={{ color: '#555', fontSize: '0.625rem', marginLeft: 'auto' }}>{s.sub}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {['전체', '노말', '하드', '익스트림'].map(d => {
            const colorMap: Record<string, string> = {
              '익스트림': '#e04040',
              '하드': '#e89030',
              '전체': 'var(--gold)',
              '노말': 'var(--gold)',
            }
            const bgMap: Record<string, string> = {
              '익스트림': 'rgba(224,64,64,0.2)',
              '하드': 'rgba(232,144,48,0.2)',
              '전체': 'rgba(200,144,10,0.15)',
              '노말': 'rgba(200,144,10,0.15)',
            }
            const borderMap: Record<string, string> = {
              '익스트림': 'rgba(224,64,64,0.4)',
              '하드': 'rgba(232,144,48,0.4)',
              '전체': 'rgba(200,144,10,0.3)',
              '노말': 'rgba(200,144,10,0.3)',
            }
            return (
              <button
                key={d}
                onClick={() => setThemeDiffFilter(d)}
                className="px-2.5 py-1.5 rounded text-[0.6875rem] transition-colors"
                style={{
                  cursor: 'pointer',
                  background: themeDiffFilter === d ? bgMap[d] : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${themeDiffFilter === d ? borderMap[d] : 'rgba(255,255,255,0.08)'}`,
                  color: themeDiffFilter === d ? colorMap[d] : '#777',
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {d}
              </button>
            )
          })}
        </div>
        <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
          {filteredThemes.length}건
        </span>
      </div>

      {/* 층별 뷰 */}
      {floorGroupedThemes ? (
        <div className="mb-8 space-y-5">
          {floorGroupedThemes.map(([startFloor, endFloor, floorThemes]) => (
            <div key={startFloor}>
              <div className="flex items-center gap-3 mb-2.5">
                <span
                  className="flex-shrink-0 font-mono font-bold"
                  style={{
                    color: startFloor === 0 ? '#888' : 'var(--gold)',
                    fontSize: '0.875rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {startFloor === 0
                    ? '기타'
                    : startFloor === endFloor
                    ? `${startFloor}층`
                    : `${startFloor}~${endFloor}층`}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: `linear-gradient(to right, ${
                      startFloor === 0 ? 'rgba(136,136,136,0.3)' : 'rgba(200,144,10,0.3)'
                    }, transparent)`,
                  }}
                />
                <span style={{ color: '#555', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>
                  {floorThemes.length}개
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {floorThemes.map(theme => (
                  <ThemePackCard key={theme.id} theme={theme} onClick={() => onThemeClick(theme.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 mb-8">
          {filteredThemes.map(theme => (
            <ThemePackCard key={theme.id} theme={theme} onClick={() => onThemeClick(theme.id)} />
          ))}
        </div>
      )}
    </>
  )
}
