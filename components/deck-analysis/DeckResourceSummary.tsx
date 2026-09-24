'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS, SIN_ORDER, getSinIconUrl } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import { ATTACK_TYPES, DEFENSE_TYPES, type AttackType, type DefenseType } from '@/lib/decks/deck-analysis'

const ATTACK_COLORS: Record<AttackType, string> = { slash: '#cc4444', pierce: '#dd8833', blunt: '#cc8822' }

type Props = {
  attack: Record<AttackType, number>
  defense: Record<DefenseType, number>
  /** Sins produced by the deck's skills. */
  production: Record<SinType, number>
  /** Summed EGO costs; sins where production falls short are marked. */
  egoCost?: Record<SinType, number>
}

/** Attack type bars and sin resource chips (produced / EGO cost) shown under the keyword chart. */
export default function DeckResourceSummary({ attack, defense, production, egoCost }: Props) {
  const tStats = useTranslations('planner.deckTab.stats')
  const tSkill = useTranslations('identity.skillType')
  const attackTotal = ATTACK_TYPES.reduce((sum, type) => sum + attack[type], 0) || 1
  const defenses = DEFENSE_TYPES.filter(type => defense[type] > 0)
  const sins = SIN_ORDER.filter(sin => production[sin] > 0 || (egoCost?.[sin] ?? 0) > 0)
  const hasCost = sins.some(sin => (egoCost?.[sin] ?? 0) > 0)

  return (
    <div className="deck-resources">
      <section aria-labelledby="deck-attack-types">
        <h3 id="deck-attack-types" className="deck-insights__title">{tStats('attackTypes')}</h3>
        <ul className="deck-resources__attacks">
          {ATTACK_TYPES.map(type => (
            <li key={type} style={{ '--atk': ATTACK_COLORS[type] } as React.CSSProperties}>
              <Image src={`${STORAGE_BASE}/icons/stats/${type}.webp`} alt="" width={16} height={16} />
              <span className="deck-resources__label">{tSkill(type)}</span>
              <span className="deck-resources__bar" aria-hidden="true"><span style={{ width: `${(attack[type] / attackTotal) * 100}%` }} /></span>
              <span className="deck-resources__count">{attack[type]}</span>
            </li>
          ))}
        </ul>
        {defenses.length > 0 && (
          <p className="deck-resources__defense">
            {defenses.map(type => <span key={type}>{tSkill(type)} <strong>{defense[type]}</strong></span>)}
          </p>
        )}
      </section>
      {sins.length > 0 && (
        <section aria-labelledby="deck-sin-resources">
          <h3 id="deck-sin-resources" className="deck-insights__title">
            {tStats('sinResources')}
            {hasCost && <span className="deck-resources__hint">{tStats('sinResourcesHint')}</span>}
          </h3>
          <ul className="deck-resources__sins">
            {sins.map(sin => {
              const need = egoCost?.[sin] ?? 0
              return (
                <li key={sin} data-short={need > production[sin] || undefined} style={{ '--sin': SIN_COLORS[sin] } as React.CSSProperties}>
                  <Image src={getSinIconUrl(sin)} alt="" width={18} height={18} />
                  <span>{production[sin]}{need > 0 && <span className="deck-resources__need">/{need}</span>}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <style jsx global>{`
        .deck-resources { display: grid; gap: 1.5rem; }
        @media (min-width: 40rem) { .deck-resources { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem; } }
        .deck-resources__attacks { display: grid; gap: 0.5rem; list-style: none; }
        .deck-resources__attacks li { display: grid; grid-template-columns: 1rem 2.5rem minmax(0, 1fr) 1.5rem; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
        .deck-resources__attacks img { width: 1rem; height: 1rem; opacity: 0.85; }
        .deck-resources__label { color: var(--atk); }
        .deck-resources__bar { height: 0.375rem; overflow: hidden; border-radius: 999px; background: rgba(232, 220, 200, 0.06); }
        .deck-resources__bar > span { display: block; height: 100%; border-radius: inherit; background: var(--atk); }
        .deck-resources__count { color: #e8dcc8; font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; }
        .deck-resources__defense { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; margin-top: 0.75rem; color: #9c8b73; font-size: 0.8125rem; }
        .deck-resources__defense strong { color: #e8dcc8; font-variant-numeric: tabular-nums; font-weight: 600; }
        .deck-resources__hint { margin-left: 0.5rem; color: #9c8b73; font-family: var(--font-body), var(--font-sans); font-size: 0.75rem; }
        .deck-resources__sins { display: flex; flex-wrap: wrap; gap: 0.375rem; list-style: none; }
        .deck-resources__sins li {
          display: inline-flex; min-height: 1.75rem; align-items: center; gap: 0.3125rem; padding: 0 0.5rem 0 0.3125rem;
          border: 1px solid color-mix(in srgb, var(--sin) 35%, transparent); border-radius: 0.25rem;
          background: color-mix(in srgb, var(--sin) 10%, transparent); color: #e8dcc8; font-size: 0.8125rem; font-variant-numeric: tabular-nums; font-weight: 600;
        }
        .deck-resources__sins img { width: 1.125rem; height: 1.125rem; }
        .deck-resources__need { color: #9c8b73; font-weight: 400; }
        .deck-resources__sins li[data-short] { border-color: rgba(155, 44, 35, 0.7); background: rgba(155, 44, 35, 0.12); }
        .deck-resources__sins li[data-short] .deck-resources__need { color: #e07060; }
      `}</style>
    </div>
  )
}
