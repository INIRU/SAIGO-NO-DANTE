'use client'

import { ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ThemePackModalPill } from '@/components/ui/ThemePackModal'
import { FLOOR_FOCUS_RING, getThemeGiftCount } from '@/features/planner/lib/floor-view'
import type { FloorDifficulty, ThemeData } from '@/lib/planner/types'

/** The open floor's title column: pack name and counts, difficulty, collapse button and the copy-from-previous button. */
export default function FloorEditorHeader({ floor, selectedTheme, themeName, pickerThemeCount, difficulty, canCopyPrevious, onDifficulty, onCollapse, onCopyPrevious }: {
  floor: number
  selectedTheme: ThemeData | null
  themeName: string | null
  pickerThemeCount: number
  difficulty: FloorDifficulty
  canCopyPrevious: boolean
  onDifficulty: (difficulty: FloorDifficulty) => void
  onCollapse: () => void
  onCopyPrevious: () => void
}) {
  const t = useTranslations('planner.floorTab')
  const tCopy = useTranslations('planner.floorCopy')
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-40">
          <h4
            className="text-[1.25rem] leading-snug"
            style={{ fontFamily: 'var(--font-heading)', color: themeName ? 'var(--gold-light)' : '#9c8b73' }}
          >
            {themeName ?? t('noTheme')}
          </h4>
          <p className="mt-0.5 text-sm" style={{ color: '#9c8b73' }}>
            {selectedTheme
              ? t('themeGiftCount', { count: getThemeGiftCount(selectedTheme) })
              : pickerThemeCount > 0 ? t('availableThemeCount', { count: pickerThemeCount }) : t('emptyThemes')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {floor <= 5 ? (
            <div
              role="group"
              className="flex rounded-md border p-0.5"
              style={{ background: 'var(--bg-deep)', borderColor: '#2e2417' }}
              aria-label={t('difficultySelectorLabel', { floor })}
            >
              {(['normal', 'hard'] as const).map(option => {
                const selected = difficulty === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onDifficulty(option)}
                    aria-pressed={selected}
                    className={`min-h-[2.5rem] rounded px-3.5 text-sm font-semibold transition-colors ${FLOOR_FOCUS_RING}`}
                    style={{
                      background: selected ? 'rgba(200,144,10,0.2)' : 'transparent',
                      color: selected ? 'var(--gold-light)' : '#9c8b73',
                    }}
                  >
                    {t(`difficulty.${option}`)}
                  </button>
                )
              })}
            </div>
          ) : (
            <ThemePackModalPill tone={difficulty === 'extreme' ? 'red' : 'gold'}>
              {t(`difficulty.${difficulty}`)}
            </ThemePackModalPill>
          )}
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t('ladder.collapse', { floor })}
            title={t('ladder.collapseShort')}
            className={`grid h-[2.75rem] w-[2.75rem] place-items-center rounded-md transition-colors hover:bg-white/5 hover:text-[var(--text-primary)] ${FLOOR_FOCUS_RING}`}
            style={{ color: '#9c8b73' }}
          >
            <ChevronUp size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 empty:hidden">
        {canCopyPrevious && (
          <button
            type="button"
            onClick={onCopyPrevious}
            className={`min-h-[2.75rem] rounded-md border px-3 text-[0.9375rem] transition-colors hover:bg-white/5 ${FLOOR_FOCUS_RING}`}
            style={{ borderColor: '#2e2417', color: '#9c8b73' }}
          >
            {tCopy('copyPrevious')}
          </button>
        )}
      </div>
    </div>
  )
}
