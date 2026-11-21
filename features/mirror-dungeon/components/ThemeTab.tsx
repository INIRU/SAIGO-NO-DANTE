'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ThemePackCard from '@/features/mirror-dungeon/components/ThemePackCard'
import SearchBox, { SuggestRow, nameMarks, type SuggestGroup } from '@/components/ui/SearchBox'
import type { EgoGift, EgoGiftTheme } from '@/features/mirror-dungeon/types'
import { givenGiftEntries, packEntries, packSuggestions } from '@/features/mirror-dungeon/lib/search-suggestions'
import { search as findHits } from '@/lib/search/engine'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'

const FLOOR_OFFSET: Record<string, number> = { '노말': 0, '하드': 0, '평행중첩': 5, '익스트림': 10 }
const FLOOR_RANGE: Record<string, [number, number]> = {
  '노말': [1, 5],
  '하드': [1, 5],
  '평행중첩': [6, 10],
  '익스트림': [11, 15],
}

type FloorRow = { start: number; end: number; parallel: boolean; themes: EgoGiftTheme[] }

const SECTIONS = [
  { key: 'normal', diff: '노말', floorKeys: ['노말'] },
  { key: 'hard', diff: '하드', floorKeys: ['하드', '평행중첩'] },
  { key: 'extreme', diff: '익스트림', floorKeys: ['익스트림'] },
]

/** floor_info → 층 번호별 묶음. 같은 테마팩 목록이 이어지는 층은 "4–5층"처럼 합친다. */
function groupByFloor(themes: EgoGiftTheme[], floorKeys: string[]): FloorRow[] {
  const floorMap = new Map<number, EgoGiftTheme[]>()
  const add = (floor: number, theme: EgoGiftTheme) => {
    const arr = floorMap.get(floor) ?? []
    if (!arr.includes(theme)) arr.push(theme)
    floorMap.set(floor, arr)
  }
  for (const theme of themes) {
    for (const key of floorKeys) {
      const floors = theme.floor_info?.[key]
      if (!floors) continue
      const offset = FLOOR_OFFSET[key] ?? 0
      if (Array.isArray(floors)) {
        for (const f of floors) add(f + offset, theme)
      } else if (floors === '전체') {
        const [from, to] = FLOOR_RANGE[key] ?? [0, -1]
        for (let f = from; f <= to; f++) add(f, theme)
      }
    }
  }
  const rows: FloorRow[] = []
  for (const [floor, floorThemes] of [...floorMap.entries()].sort((a, b) => a[0] - b[0])) {
    const parallel = floor >= 6 && floor <= 10
    const prev = rows[rows.length - 1]
    if (prev && floor === prev.end + 1 && prev.parallel === parallel && prev.themes.length === floorThemes.length && floorThemes.every(th => prev.themes.includes(th))) {
      prev.end = floor
      continue
    }
    rows.push({ start: floor, end: floor, parallel, themes: floorThemes })
  }
  return rows
}

interface ThemeTabProps {
  lang: SupportedLang
  themes: EgoGiftTheme[]
  giftByGameId: Map<number, EgoGift>
  themeSearch: string
  themeDiffFilter: string
  setThemeSearch: (v: string) => void
  setThemeDiffFilter: (v: string) => void
  onThemeClick: (id: number) => void
}

export default function ThemeTab({
  lang,
  themes,
  giftByGameId,
  themeSearch,
  themeDiffFilter,
  setThemeSearch,
  setThemeDiffFilter,
  onThemeClick,
}: ThemeTabProps) {
  const [showHidden, setShowHidden] = useState(false)
  const tp = useTranslations('mirrorDungeonPage')

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

  const packIndex = useMemo(() => packEntries(normalThemes, giftByGameId, lang), [normalThemes, giftByGameId, lang])
  // Gifts some pack gives, with how many packs give each: picking one searches for the packs that hold it.
  const giftIndex = useMemo(() => givenGiftEntries(normalThemes.map(th => th.ego_gift_ids), giftByGameId, lang), [normalThemes, giftByGameId, lang])
  const themeById = useMemo(() => new Map(normalThemes.map(th => [String(th.id), th])), [normalThemes])

  const suggestGroups = useMemo<SuggestGroup[]>(() => {
    const found = packSuggestions(packIndex, giftIndex, themeSearch)
    return [
      {
        title: t('mirrorDungeon.tab.themes'),
        rows: found.packs.map(hit => {
          const theme = themeById.get(hit.entry.href)!
          const hard = theme.difficulty === 'hard' || theme.difficulty === 'extreme'
          return {
            key: `p${theme.id}`,
            onPick: () => onThemeClick(theme.id),
            body: <SuggestRow poster image={hit.entry.icon} name={hit.entry.label} marks={nameMarks(hit)}
              right={hard ? t(`mirrorDungeon.tier.${theme.difficulty}`) : undefined} rightColor="var(--error-text)" />,
          }
        }),
      },
      {
        title: t('mirrorDungeon.tab.gifts'),
        rows: found.gifts.map(hit => ({
          key: `g${hit.entry.href}`,
          onPick: () => setThemeSearch(hit.entry.label),
          body: <SuggestRow image={hit.entry.icon} name={hit.entry.label} marks={nameMarks(hit)} right={tp('packCount', { count: Number(hit.entry.sublabel) })} />,
        })),
      },
    ].filter(group => group.rows.length > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packIndex, giftIndex, themeById, themeSearch, lang, onThemeClick, setThemeSearch])

  // 난이도 필터는 보여줄 구역을 고른다. 검색은 모든 구역에 적용.
  const searchedThemes = useMemo(() => {
    const q = themeSearch.trim()
    if (!q) return normalThemes
    return findHits(packIndex, q).map(hit => themeById.get(hit.entry.href)!)
  }, [normalThemes, themeSearch, packIndex, themeById])

  const sections = useMemo(() => {
    const visible = SECTIONS.filter(sec => themeDiffFilter === '전체' || sec.diff === themeDiffFilter)
    const result = visible
      .map(sec => ({ ...sec, rows: groupByFloor(searchedThemes, sec.floorKeys) }))
      .filter(sec => sec.rows.length > 0)
    if (themeDiffFilter === '전체') {
      const unassigned = searchedThemes.filter(th => !th.floor_info || !Object.keys(th.floor_info).some(k => FLOOR_OFFSET[k] !== undefined))
      if (unassigned.length > 0) result.push({ key: 'other', diff: '기타', floorKeys: [], rows: [{ start: 0, end: 0, parallel: false, themes: unassigned }] })
    }
    return result
  }, [searchedThemes, themeDiffFilter])

  const shownCount = useMemo(() => {
    const ids = new Set<number>()
    for (const sec of sections) for (const row of sec.rows) for (const th of row.themes) ids.add(th.id)
    return ids.size
  }, [sections])

  // Localized difficulty button labels (filter values stay Korean)
  const DIFF_LABELS: Record<string, string> = {
    '전체': t('mirrorDungeon.tier.all'),
    '노말': t('mirrorDungeon.tier.normal'),
    '하드': t('mirrorDungeon.tier.hard'),
    '익스트림': t('mirrorDungeon.tier.extreme'),
    '기타': t('mirrorDungeon.theme.other'),
  }
  const floorUnit = t('mirrorDungeon.theme.floor')
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-deep)]'
  const posterGrid = 'grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8'
  const posterSizes = '(max-width: 640px) 33vw, (max-width: 1024px) 17vw, 10rem'

  return (
    <>
      {/* 검색 + 난이도 — 상단 고정 */}
      <div
        role="search"
        aria-label={tp('themeFilters')}
        className="sticky-under-nav z-30 -mx-4 mb-6 flex flex-wrap items-center gap-2 px-4 py-2.5 md:-mx-6 md:px-6"
        style={{ background: 'var(--bg-deep)', borderBottom: '1px solid #2e2417' }}
      >
        <SearchBox
          value={themeSearch}
          onChange={setThemeSearch}
          label={t('mirrorDungeon.theme.search')}
          clearLabel={t('mirrorDungeon.filter.reset')}
          groups={suggestGroups}
          className="w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-[20rem]"
        />

        <div role="group" aria-label={t('mirrorDungeon.theme.difficulty')} className="flex items-stretch" style={{ border: '1px solid #2e2417', borderRadius: '0.25rem' }}>
          {(['전체', '노말', '하드', '익스트림'] as const).map((d, i) => {
            const active = themeDiffFilter === d
            const isExtreme = d === '익스트림'
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => setThemeDiffFilter(d)}
                className={`min-h-[2.25rem] px-3 text-[0.8125rem] transition-colors hover:text-[var(--text-primary)] ${focusRing}`}
                style={{
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)',
                  color: active ? (isExtreme ? '#f3e2d6' : 'var(--bg-deep)') : '#9c8b73',
                  background: active ? (isExtreme ? '#9b2c23' : 'var(--gold)') : 'transparent',
                  borderLeft: i > 0 ? '1px solid #2e2417' : 'none',
                }}
              >
                {DIFF_LABELS[d]}
              </button>
            )
          })}
        </div>

        <p className="ml-auto flex items-baseline gap-1 tabular-nums" aria-live="polite">
          <span style={{ color: 'var(--gold-light)', fontFamily: 'var(--font-title)', fontSize: '1.5rem', lineHeight: 1 }}>{shownCount}</span>
          <span style={{ color: '#9c8b73', fontSize: '0.75rem' }}>{tp('packUnit')}</span>
        </p>
      </div>

      {sections.length === 0 && (
        <p className="py-20 text-center" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)' }}>{t('mirrorDungeon.empty.title')}</p>
      )}

      {/* 난이도 구역 → 층 */}
      <div className="mb-10 space-y-12">
        {sections.map(sec => {
          const isExtreme = sec.key === 'extreme'
          const accent = isExtreme ? '#9b2c23' : sec.key === 'other' ? '#9c8b73' : 'var(--gold)'
          const first = sec.rows[0]
          const last = sec.rows[sec.rows.length - 1]
          const range = sec.key === 'other' ? null : first.start === last.end ? `${first.start}` : `${first.start}–${last.end}`
          const packCount = new Set(sec.rows.flatMap(r => r.themes.map(th => th.id))).size
          return (
            <section key={sec.key} aria-labelledby={`md-sec-${sec.key}`}>
              <header className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-1" style={{ borderBottom: `2px solid ${accent}`, paddingBottom: '0.5rem' }}>
                <h2
                  id={`md-sec-${sec.key}`}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.5rem',
                    lineHeight: 1.1,
                    color: isExtreme ? '#f3e2d6' : 'var(--text-primary)',
                    background: isExtreme ? '#9b2c23' : 'transparent',
                    padding: isExtreme ? '0.25rem 0.625rem 0.125rem' : 0,
                  }}
                >
                  {DIFF_LABELS[sec.diff]}
                </h2>
                {range && (
                  <span className="flex items-baseline gap-0.5" style={{ color: isExtreme ? '#c9574b' : 'var(--gold-light)' }}>
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', lineHeight: 1 }}>{range}</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem' }}>{floorUnit}</span>
                  </span>
                )}
                <span className="ml-auto" style={{ color: '#9c8b73', fontSize: '0.8125rem' }}>{tp('packCount', { count: packCount })}</span>
              </header>

              <div className="space-y-5">
                {sec.rows.map(row => (
                  <div key={`${row.start}-${row.parallel}`} className="sm:grid sm:grid-cols-[6rem_1fr] sm:gap-4">
                    {sec.key !== 'other' && (
                      <div className="mb-2 flex items-baseline gap-2 sm:sticky sm:top-16 sm:mb-0 sm:block sm:self-start" style={{ borderTop: '1px solid #2e2417', paddingTop: '0.375rem' }}>
                        <span className="tabular-nums" style={{ display: 'block', whiteSpace: 'nowrap', fontFamily: 'var(--font-title)', fontSize: '2rem', lineHeight: 0.95, color: isExtreme ? '#c9574b' : 'var(--gold)' }}>
                          {row.start === row.end ? row.start : `${row.start}–${row.end}`}
                          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', marginLeft: '0.125rem' }}>{floorUnit}</span>
                        </span>
                        {row.parallel && (
                          <span style={{ display: 'block', color: '#9c8b73', fontSize: '0.75rem', fontFamily: 'var(--font-heading)', marginTop: '0.25rem' }}>
                            {t('mirrorDungeon.tier.parallel')}
                          </span>
                        )}
                      </div>
                    )}
                    <div className={`${posterGrid} ${sec.key === 'other' ? 'sm:col-span-2' : ''}`}>
                      {row.themes.map(theme => (
                        <ThemePackCard key={theme.id} theme={theme} onClick={() => onThemeClick(theme.id)} lang={lang} sizes={posterSizes} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* 히든 테마팩 */}
      {hiddenThemes.length > 0 && (
        <section className="mt-12" aria-labelledby="md-sec-hidden">
          <header className="mb-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid #3a2f4a', paddingBottom: '0.5rem' }}>
            <h2 id="md-sec-hidden" style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: '#b8a3cf' }}>
              {t('mirrorDungeon.theme.hidden')}
            </h2>
            <button
              type="button"
              aria-pressed={showHidden}
              onClick={() => setShowHidden(v => !v)}
              className={`ml-auto flex min-h-[2.25rem] items-center gap-2 px-3 transition-colors ${focusRing}`}
              style={{
                border: '1px solid #3a2f4a',
                borderRadius: '0.25rem',
                color: showHidden ? '#d4c2e6' : '#9c8b73',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {showHidden ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
              {showHidden ? t('mirrorDungeon.theme.spoilerHide') : t('mirrorDungeon.theme.spoilerShow')}
            </button>
          </header>
          <div className={posterGrid}>
            {showHidden
              ? hiddenThemes.map(theme => (
                  <ThemePackCard key={theme.id} theme={theme} onClick={() => onThemeClick(theme.id)} lang={lang} sizes={posterSizes} />
                ))
              : (
                  <div
                    className="flex flex-col items-center justify-center text-center"
                    style={{ aspectRatio: '416/684', border: '1px dashed #3a2f4a', background: '#141019', padding: '0.75rem', whiteSpace: 'pre-line' }}
                  >
                    <span style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: '#a08cc0', lineHeight: 1 }}>{hiddenThemes.length}</span>
                    <span style={{ marginTop: '0.5rem', color: '#9c8bb0', fontSize: '0.75rem', fontFamily: 'var(--font-heading)', lineHeight: 1.4 }}>
                      {t('mirrorDungeon.theme.hiddenExists')}
                    </span>
                  </div>
                )}
          </div>
        </section>
      )}
    </>
  )
}
