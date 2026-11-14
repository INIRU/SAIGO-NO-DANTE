'use client'

import { Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useTranslations } from 'next-intl'
import { COMPACT_KOTRA_STYLE } from '@/lib/planner/compact-name-style'

export type DeckSubTab = 'identity' | 'ego' | 'skillset'

const SUB_TABS: { key: DeckSubTab; labelKey: string; icon: typeof Users }[] = [
  { key: 'identity', labelKey: 'subTabs.identity', icon: Users },
  { key: 'ego', labelKey: 'subTabs.ego', icon: Sparkles },
  { key: 'skillset', labelKey: 'subTabs.skillset', icon: SlidersHorizontal },
]

/** The deck tab's sub-tab strip (identity, E.G.O, skill exchange) and the formation count at its end. */
export default function DeckSubTabs({ subTab, onChange, formationCount }: {
  subTab: DeckSubTab
  onChange: (tab: DeckSubTab) => void
  formationCount: number
}) {
  const tDeck = useTranslations('planner.deckTab')
  const reduceMotion = useReducedMotion()
  return (
    <div
      className="mb-6 flex items-center gap-1 overflow-x-auto"
      role="tablist"
      aria-label={tDeck('subTabs.label')}
      style={{ borderBottom: '1px solid var(--bg-card)', WebkitOverflowScrolling: 'touch' }}
    >
      {SUB_TABS.map(tab => {
        const active = subTab === tab.key
        const Icon = tab.icon
        return (
          <m.button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className="flex flex-shrink-0 items-center gap-1.5 transition-[background-color,border-color,color] duration-200"
            style={{
              ...COMPACT_KOTRA_STYLE,
              padding: '0.5rem 1rem',
              fontSize: '0.9375rem',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
              background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
              cursor: 'pointer',
            }}
            whileHover={reduceMotion ? undefined : { y: -1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 430, damping: 32, mass: 0.5 }}
          >
            <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
            {tDeck(tab.labelKey)}
          </m.button>
        )
      })}
      <div className="ml-auto flex flex-shrink-0 items-center font-mono" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', paddingRight: '0.5rem' }}>
        {formationCount} / 12
      </div>
    </div>
  )
}
