'use client'

import { useMemo, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, X } from 'lucide-react'
import type { RunState } from '@/features/planner/lib/run-types'
import type { ThemeData } from '@/lib/planner/types'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { getAvailableThemes } from '@/lib/planner/fusion'
import ThemePackCard from '@/components/ui/ThemePackCard'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface Props {
  state: RunState
  themes: ThemeData[]
  onSelect: (theme: ThemeData) => void
  /** Clears the current floor's pack; shown only while one is selected. */
  onClear?: () => void
  onClose: () => void
}

export default function ThemeSection({ state, themes, onSelect, onClear, onClose }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const heading = useRef<HTMLHeadingElement>(null)
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const currentDifficulty = isFloorDifficulty(currentLog?.difficulty) && isAllowedFloorDifficulty(currentLog.difficulty, state.currentFloor)
    ? currentLog.difficulty
    : getLegacyPlanFloorDifficulty(state.difficulty, state.currentFloor)
  const available = useMemo(
    () => getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[currentDifficulty], state.currentFloor),
    [themes, currentDifficulty, state.currentFloor],
  )
  const selected = themes.find(theme => String(theme.id) === String(currentLog?.themeId))
  const selectedName = selected ? getLocalizedName({ name_kr: selected.name, name_en: selected.name_en, name_jp: selected.name_jp }, locale) : String(currentLog?.themeId ?? '')

  return <section>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 ref={heading} tabIndex={-1} className="text-sm font-bold text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('chooseThemeCount', { count: available.length })}</h3>
      <div className="flex flex-wrap items-center gap-1">
      {onClear && currentLog?.themeId && <button type="button" data-clear-theme onClick={() => {
        onClear()
        // The button leaves with the selection, so keep focus in the picker for the next choice.
        requestAnimationFrame(() => heading.current?.focus())
      }} aria-label={t('clearThemeLabel', { floor: state.currentFloor, name: selectedName })}
        className="inline-flex min-h-10 items-center gap-1 rounded-md border border-[var(--border)] px-2 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"><X size={14} aria-hidden="true" /> {t('clearTheme')}</button>}
      <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"><ArrowLeft size={14} /> {t('backToGiftLog')}</button>
      </div>
    </div>
    {available.length === 0 ? <p className="py-6 text-sm text-[var(--text-secondary)]">{t('noAvailableThemes')}</p> :
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-x-2 gap-y-2.5 sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]">
        {available.map(theme => <div key={theme.id} className="mx-auto w-full max-w-[8rem]"><ThemePackCard theme={theme} onClick={() => onSelect(theme)} isSelected={String(currentLog?.themeId) === String(theme.id)} imageSurface="bare" sizes="(max-width: 640px) 34vw, 128px" /></div>)}
      </div>}
  </section>
}
