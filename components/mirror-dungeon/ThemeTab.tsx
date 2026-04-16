'use client'

import { useMemo, useState } from 'react'
import { Search, X, Eye, EyeOff } from 'lucide-react'
import { useLocale } from 'next-intl'
import ThemePackCard from '@/components/mirror-dungeon/ThemePackCard'
import type { EgoGift, EgoGiftTheme } from '@/components/mirror-dungeon/types'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'

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
  const [showHidden, setShowHidden] = useState(false)

  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  // Separate hidden themes from normal themes
  const normalThemes = useMemo(
    () => themes.filter(th => !th.is_hidden),
    [themes]
  )
  const hiddenThemes = useMemo(
    () => themes.filter(th => th.is_hidden === true),
    [themes]
  )

  const themeSearchSuggestions = useMemo(() => {
    if (!themeSearch.trim() || themeSearch.trim().length < 1) return []
    const q = themeSearch.trim().toLowerCase()
    const suggestions: Array<{ type: 'theme' | 'gift'; label: string; sub?: string }> = []
    for (const th of normalThemes) {
      const displayName = getLocalizedName({ name_kr: th.name, name_en: th.name_en, name_jp: th.name_jp }, lang)
      if (displayName.toLowerCase().includes(q)) {
        const diff =
          th.difficulty === 'hard'
            ? ` [${t('mirrorDungeon.tier.hard')}]`
            : th.difficulty === 'extreme'
            ? ` [${t('mirrorDungeon.tier.extreme')}]`
            : ''
        suggestions.push({ type: 'theme', label: displayName, sub: diff })
      }
      if (suggestions.length >= 8) break
    }
    if (suggestions.length < 8) {
      const seen = new Set<string>()
      for (const g of gifts) {
        const gName = getLocalizedName({ name_kr: g.name, name_en: g.name_en, name_jp: g.name_jp }, lang)
        if (gName.toLowerCase().includes(q) && !seen.has(gName)) {
          seen.add(gName)
          const belongThemes = normalThemes.filter(th => g.game_id && th.ego_gift_ids.includes(g.game_id))
          if (belongThemes.length > 0) {
            const countLabel = lang === 'ko'
              ? `${belongThemes.length}개 ${t('mirrorDungeon.theme.autocompleteTheme')}`
              : `${belongThemes.length} ${t('mirrorDungeon.theme.autocompleteTheme')}`
            suggestions.push({ type: 'gift', label: gName, sub: countLabel })
          }
          if (suggestions.length >= 8) break
        }
      }
    }
    return suggestions
  }, [themeSearch, normalThemes, gifts, lang])

  const filteredThemes = useMemo(() => {
    let result = normalThemes
    if (themeDiffFilter !== '전체') {
      const diffMap: Record<string, string> = { '노말': 'normal', '하드': 'hard', '익스트림': 'extreme' }
      result = result.filter(th => th.difficulty === diffMap[themeDiffFilter])
    }
    if (themeSearch.trim()) {
      const q = themeSearch.trim().toLowerCase()
      result = result.filter(th => {
        const displayName = getLocalizedName({ name_kr: th.name, name_en: th.name_en, name_jp: th.name_jp }, lang)
        if (displayName.toLowerCase().includes(q)) return true
        return th.ego_gift_ids.some(gid => {
          const g = giftByGameId.get(gid)
          if (!g) return false
          const gName = getLocalizedName({ name_kr: g.name, name_en: g.name_en, name_jp: g.name_jp }, lang)
          return gName.toLowerCase().includes(q)
        })
      })
    }
    return result
  }, [normalThemes, themeSearch, themeDiffFilter, giftByGameId, lang])

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
        const floors = theme.floor_info[key]
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

    const unassigned = filteredThemes.filter(th => {
      if (!th.floor_info) return true
      return !floorKeys.some(k => th.floor_info?.[k])
    })

    const sorted = [...floorMap.entries()].sort((a, b) => a[0] - b[0])
    const merged: [number, number, EgoGiftTheme[]][] = []
    for (const [floor, floorThemes] of sorted) {
      const ids = new Set(floorThemes.map(th => th.id))
      const prev = merged[merged.length - 1]
      if (prev && floor === prev[1] + 1) {
        const prevIds = new Set(prev[2].map(th => th.id))
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

  // Localized difficulty button labels (filter values stay Korean)
  const DIFF_LABELS: Record<string, string> = {
    '전체': t('mirrorDungeon.tier.all'),
    '노말': t('mirrorDungeon.tier.normal'),
    '하드': t('mirrorDungeon.tier.hard'),
    '익스트림': t('mirrorDungeon.tier.extreme'),
  }

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
            placeholder={t('mirrorDungeon.theme.search')}
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
                    {s.type === 'theme' ? t('mirrorDungeon.theme.autocompleteTheme') : t('mirrorDungeon.theme.autocompleteGift')}
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
          {(['전체', '노말', '하드', '익스트림'] as const).map(d => {
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
                {DIFF_LABELS[d]}
              </button>
            )
          })}
        </div>
        <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'var(--font-heading)' }}>
          {filteredThemes.length}{lang === 'ko' ? '건' : ''}
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
                    ? t('mirrorDungeon.theme.other')
                    : startFloor === endFloor
                    ? lang === 'ko'
                      ? `${startFloor}층`
                      : `${t('mirrorDungeon.theme.floor')}${startFloor}`
                    : lang === 'ko'
                    ? `${startFloor}~${endFloor}층`
                    : `${t('mirrorDungeon.theme.floor')}${startFloor}~${endFloor}`}
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
                  {floorThemes.length}{lang === 'ko' ? '개' : ''}
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

      {/* 히든 테마팩 섹션 */}
      {hiddenThemes.length > 0 && (
        <div className="mt-6">
          {/* 섹션 구분선 */}
          <div className="flex items-center gap-3 mb-4">
            <div
              style={{
                flex: 1,
                height: '1px',
                background: 'linear-gradient(to right, rgba(100,80,140,0.5), transparent)',
              }}
            />
            <span
              style={{
                color: '#9070b0',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.12em',
                whiteSpace: 'nowrap',
              }}
            >
              {t('mirrorDungeon.theme.hidden')}
            </span>
            <div
              style={{
                flex: 1,
                height: '1px',
                background: 'linear-gradient(to left, rgba(100,80,140,0.5), transparent)',
              }}
            />
          </div>

          {/* 스포일러 토글 버튼 */}
          <div className="flex justify-center mb-4">
            <button
              onClick={() => setShowHidden(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200"
              style={{
                background: showHidden ? 'rgba(144,112,176,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showHidden ? 'rgba(144,112,176,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: showHidden ? '#b090d0' : '#666',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.05em',
              }}
            >
              {showHidden ? (
                <EyeOff size={13} />
              ) : (
                <Eye size={13} />
              )}
              {showHidden ? t('mirrorDungeon.theme.spoilerHide') : t('mirrorDungeon.theme.spoilerShow')}
            </button>
          </div>

          {/* 히든 카드 영역 */}
          {showHidden ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
              {hiddenThemes.map(theme => (
                <ThemePackCard key={theme.id} theme={theme} onClick={() => onThemeClick(theme.id)} />
              ))}
            </div>
          ) : (
            /* 미공개 플레이스홀더 카드 */
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
              <div
                className="flex flex-col items-center justify-center rounded-lg"
                style={{
                  width: '8rem',
                  minHeight: '12rem',
                  background: 'linear-gradient(135deg, rgba(80,60,120,0.15) 0%, rgba(40,30,60,0.3) 100%)',
                  border: '1px solid rgba(144,112,176,0.2)',
                  padding: '1.25rem 0.75rem',
                }}
              >
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontFamily: 'var(--font-heading)',
                    color: 'rgba(144,112,176,0.5)',
                    letterSpacing: '0.2em',
                    marginBottom: '0.75rem',
                  }}
                >
                  ???
                </div>
                <div
                  style={{
                    color: 'rgba(144,112,176,0.6)',
                    fontSize: '0.625rem',
                    fontFamily: 'var(--font-heading)',
                    textAlign: 'center',
                    lineHeight: 1.5,
                    letterSpacing: '0.03em',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {t('mirrorDungeon.theme.hiddenExists')}
                </div>
                <div
                  style={{
                    marginTop: '0.75rem',
                    color: 'rgba(144,112,176,0.35)',
                    fontSize: '0.5625rem',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {hiddenThemes.length}{lang === 'ko' ? '종' : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
