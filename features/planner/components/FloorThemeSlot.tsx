'use client'

import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import ThemePackStack from '@/features/planner/components/ThemePackStack'
import { FLOOR_FOCUS_RING } from '@/features/planner/lib/floor-view'
import type { ThemeData } from '@/lib/planner/types'
import type { SupportedLang } from '@/lib/i18n/types'

/** The open floor's pack column: the packs stacked as the control, or an add button while none is chosen. */
export default function FloorThemeSlot({ floor, selectedTheme, altThemes, themeName, pickerEmpty, onOpenPicker }: {
  floor: number
  selectedTheme: ThemeData | null
  altThemes: ThemeData[]
  themeName: string | null
  /** No pack is available to pick on this floor. */
  pickerEmpty: boolean
  onOpenPicker: () => void
}) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.floorTab')
  return (
    <div className="min-w-0 sm:row-span-2">
      {selectedTheme ? (
        <>
          {/* The packs are the control: the first choice with its fallbacks behind it; a click opens the picker. */}
          <ThemePackStack
            themes={[selectedTheme, ...altThemes]}
            lang={locale}
            sizes="(max-width: 640px) 104px, 144px"
            ariaLabel={t('ladder.changeThemeAria', { floor, theme: themeName ?? selectedTheme.name })}
            onClick={onOpenPicker}
          />
          <p className="mt-1.5 w-[var(--w)] text-balance text-center text-xs leading-snug" style={{ color: '#9c8b73' }}>{t('themeClickHint')}</p>
        </>
      ) : (
        <button
          type="button"
          onClick={onOpenPicker}
          disabled={pickerEmpty}
          aria-label={t('selectTheme')}
          className={`flex aspect-[416/684] w-[var(--w)] items-center justify-center rounded-sm border border-dashed transition-colors hover:border-[var(--gold)] hover:text-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-60 ${FLOOR_FOCUS_RING}`}
          style={{ borderColor: '#4a3b28', background: 'var(--bg-panel)', color: 'var(--text-muted)' }}
        >
          <Plus size={28} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
