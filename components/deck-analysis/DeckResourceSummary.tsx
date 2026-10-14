'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS, SIN_ORDER, getSinIconUrl } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import { ATTACK_TYPES, DEFENSE_TYPES, type AttackType, type DeckResources } from '@/lib/decks/deck-analysis'
import KeywordChart from '@/components/planner/KeywordChart'

const ATTACK_COLORS: Record<AttackType, string> = { slash: '#cc4444', pierce: '#dd8833', blunt: '#cc8822' }

/**
 * Attack types and sin resources under the keyword chart, in its bars: what the deployed identities' own skills are and
 * produce (computeDeckResources). Defensive skills and EGOs are not part of those counts; a line under each chart
 * names them.
 */
export default function DeckResourceSummary({ resources }: { resources: DeckResources }) {
  const tDeck = useTranslations('planner.deckTab')
  const tSkill = useTranslations('identity.skillType')
  const tSin = useTranslations('sin')
  const { attack, production, egoCost } = resources
  // Which identities the numbers are of: the deployed ones, or every placed one while nobody is deployed.
  const basis = <span className="deck-resources__basis">{tDeck(resources.deployedOnly ? 'stats.keywordDeployed' : 'stats.keywordAll', { count: resources.identities })}</span>
  const types = <T extends AttackType | (typeof DEFENSE_TYPES)[number]>(list: readonly T[], counts: Record<T, number>) => (
    list.filter(type => counts[type] > 0).map(type => <span key={type}>{tSkill(type as AttackType)} <strong>{counts[type]}</strong></span>)
  )
  const defense = types(DEFENSE_TYPES, attack.defense)
  const ego = types(ATTACK_TYPES, attack.ego)
  const produced = SIN_ORDER.filter(sin => production[sin] > 0)
  const costs = SIN_ORDER.filter(sin => egoCost[sin] > 0)

  return (
    <div className="deck-resources">
      <section aria-labelledby="deck-attack-types">
        <h3 id="deck-attack-types" className="deck-insights__title">{tDeck('stats.attackTypes')}{basis}</h3>
        <KeywordChart
          getKeywordLabel={type => tSkill(type as AttackType)}
          distribution={ATTACK_TYPES.map(type => ({ keyword: type, count: attack.skills[type], iconUrl: `${STORAGE_BASE}/icons/stats/${type}.webp`, color: ATTACK_COLORS[type] }))}
        />
        {(defense.length > 0 || ego.length > 0) && (
          <dl className="deck-resources__apart">
            {defense.length > 0 && <div data-deck-defense><dt>{tDeck('stats.defenseSkills')}</dt><dd>{defense}</dd></div>}
            {ego.length > 0 && <div data-deck-ego-attack><dt>{tDeck('subTabs.ego')}</dt><dd>{ego}</dd></div>}
          </dl>
        )}
      </section>
      {(produced.length > 0 || costs.length > 0) && (
        <section aria-labelledby="deck-sin-resources">
          <h3 id="deck-sin-resources" className="deck-insights__title">{tDeck('stats.sinResources')}{basis}</h3>
          <KeywordChart
            getKeywordLabel={sin => tSin(sin as SinType)}
            distribution={produced.map(sin => ({ keyword: sin, count: production[sin], iconUrl: getSinIconUrl(sin), color: SIN_COLORS[sin] }))}
          />
          {costs.length > 0 && (
            <dl className="deck-resources__apart">
              <div data-deck-ego-cost>
                <dt>{tDeck('stats.egoCost')}</dt>
                <dd>{costs.map(sin => (
                  // More than the deployed identities produce: the EGOs cannot all be paid for.
                  <span key={sin} className="deck-resources__cost" data-sin={sin} data-short={egoCost[sin] > production[sin] || undefined} title={tSin(sin)}>
                    <Image src={getSinIconUrl(sin)} alt={tSin(sin)} width={16} height={16} /><strong>{egoCost[sin]}</strong>
                  </span>
                ))}</dd>
              </div>
            </dl>
          )}
        </section>
      )}
      <style jsx global>{`
        .deck-resources { display: grid; gap: 2rem; }
        .deck-resources__basis { margin-left: 0.5rem; color: #9c8b73; font-family: var(--font-body), var(--font-sans); font-size: 0.75rem; }
        /* Under the bars, starting where the bars' labels start (the icon column and its gap). */
        .deck-resources__apart { display: grid; gap: 0.25rem; margin-top: 0.75rem; padding-left: 1.5rem; color: #9c8b73; font-size: 0.8125rem; }
        .deck-resources__apart > div { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; }
        .deck-resources__apart dt { min-width: 5.5rem; color: #b0a898; }
        .deck-resources__apart dd { display: flex; flex: 1; flex-wrap: wrap; gap: 0.25rem 1rem; }
        .deck-resources__apart strong { color: #e8dcc8; font-variant-numeric: tabular-nums; font-weight: 600; }
        .deck-resources__cost { display: inline-flex; align-items: center; gap: 0.25rem; }
        .deck-resources__cost img { width: 1rem; height: 1rem; }
        .deck-resources__cost[data-short] strong { color: #e07060; }
      `}</style>
    </div>
  )
}
