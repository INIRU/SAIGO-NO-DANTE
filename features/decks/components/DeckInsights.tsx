'use client'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { SIN_COLORS, getSinIconUrl } from '@/lib/constants/sin'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { computeKeywordDistribution } from '@/lib/planner/fusion'
import { getPassiveCondition, passiveRequirements, type PlannerPassiveLike } from '@/lib/planner/passives'
import { ACTIVATION_ORDER, STOCK_MAX_TURNS, rateIdentityPassive, type PassiveActivation, type SinWeights } from '@/features/decks/lib/passive-activation'
import KeywordChart, { type KeywordChartContributor } from '@/features/planner/components/KeywordChart'
import SkillDescription from '@/features/catalog/components/SkillDescription'
import { PassiveNameLabel } from '@/features/catalog/components/PassiveParts'
import { useWheelIntent } from '@/lib/hooks/useWheelIntent'
import { localizeDeckKeyword } from '@/features/decks/lib/decks-types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useOwnKeywordSets } from '@/lib/hooks/useOwnKeywords'
import type { SupportedLang } from '@/lib/i18n/types'

/** Name/description already localized by the caller. */
export type DeckInsightPassive = {
  id?: string | number
  name: string
  description: string | null
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  sin_requirements?: { sin: string; count: number }[] | null
  active_cond: string | null
}

/** One placed identity, in sinner order. */
export type DeckInsightIdentity = {
  id: string
  name: string
  sinnerName: string
  /** Square info image ('' when unknown). */
  imageUrl: string
  keywords: string[]
  passives: DeckInsightPassive[]
  /** Cards per sin of this identity's skill deck (its sin production alone); without it no activation level is shown. */
  deck?: SinWeights
}

type Props = {
  identities: DeckInsightIdentity[]
  /** Sin resources the deck produces with the current skill distribution (keys: English sins). */
  sinCounts: Record<string, number>
  /** Same with the base 3-2-1 distribution; flags passives the custom distribution breaks. */
  baseSinCounts?: Record<string, number>
  /** Extra block under the keyword chart (attack types / sin resources). */
  summary?: ReactNode
  /** Identities in SELECTED slots: the keyword chart then also shows the deployed count over all 12. */
  deployedIds?: ReadonlySet<string>
}

const asConditionPassive = (passive: DeckInsightPassive): PlannerPassiveLike => ({
  identity_id: '',
  name: passive.name,
  passive_type: passive.passive_type,
  sin_affinity: passive.sin_affinity,
  sin_count: passive.sin_count,
  sin_requirements: passive.sin_requirements,
  active_cond: passive.active_cond,
  description: passive.description,
})

/** Planner deck analysis: keyword distribution with 1:1 profiles, and battle/support passives whose column matches the keyword column height. */
export default function DeckInsights({ identities, sinCounts, baseSinCounts, summary, deployedIds }: Props) {
  const tDeck = useTranslations('planner.deckTab')
  const locale = useLocale() as SupportedLang
  const { keywords: keywordInfo } = useKeywordData()
  const [passiveType, setPassiveType] = useState<'battle' | 'support'>('battle')
  // The list scrolls inside the keyword column's height; a page scroll passing over it keeps scrolling the page.
  const scrollRef = useRef<HTMLDivElement>(null)
  useWheelIntent(scrollRef)

  const getKeywordLabel = useCallback(
    (keyword: string) => localizeDeckKeyword(keyword, keywordInfo[keyword], locale),
    [keywordInfo, locale],
  )
  const distribution = useMemo(() => computeKeywordDistribution(
    identities.map(identity => identity.keywords),
    deployedIds ? identities.map(identity => deployedIds.has(identity.id)) : undefined,
  ), [identities, deployedIds])
  const contributors = useMemo(() => {
    const map: Record<string, KeywordChartContributor[]> = {}
    for (const identity of identities) {
      if (!identity.imageUrl) continue
      const contributor = { id: identity.id, name: identity.name, imageUrl: identity.imageUrl }
      for (const keyword of new Set(identity.keywords.map(normalizeThemeKeyword))) {
        if (keyword) (map[keyword] ??= []).push(contributor)
      }
    }
    return map
  }, [identities])

  // Per identity: its keywords and what its own passives reference; plain words of older passive text are searched among these.
  const owners = useMemo(() => identities.map(identity => ({ id: identity.id, keywords: identity.keywords, texts: identity.passives.map(passive => passive.description) })), [identities])
  const ownKeywords = useOwnKeywordSets(owners)

  // Who fights: the deployed identities, or every placed one while nobody is deployed yet. Their skill decks feed every passive's activation.
  const fieldedIds = useMemo(() => {
    const deployed = deployedIds ? identities.filter(identity => deployedIds.has(identity.id)) : []
    return new Set((deployed.length ? deployed : identities).map(identity => identity.id))
  }, [identities, deployedIds])
  const team = useMemo(() => identities.flatMap(identity => (fieldedIds.has(identity.id) && identity.deck ? [identity.deck] : [])), [identities, fieldedIds])

  // Hardest to activate first inside an identity; passives without a stock or resonance condition keep their order after the rated ones.
  const groups = useMemo(() => identities.flatMap(identity => {
    const list = identity.passives
      .filter(passive => passive.passive_type === passiveType)
      .map((passive, index) => ({
        passive,
        index,
        activation: rateIdentityPassive(passive, passiveRequirements(passive), fieldedIds.has(identity.id), team),
      }))
      .sort((a, b) => (a.activation ? ACTIVATION_ORDER[a.activation.level] : 4) - (b.activation ? ACTIVATION_ORDER[b.activation.level] : 4) || a.index - b.index)
    return list.length ? [{ identity, list }] : []
  }), [identities, passiveType, fieldedIds, team])

  const activationValue = (activation: PassiveActivation) => {
    if (activation.level === 'impossible') return undefined
    if (activation.kind === 'resonance') return tDeck('stats.activationChance', { percent: Math.round(activation.chance * 100) })
    return activation.turns === null ? tDeck('stats.activationTurnsOver', { count: STOCK_MAX_TURNS }) : tDeck('stats.activationTurns', { count: activation.turns })
  }

  return (
    <div className="deck-insights">
      <div className="deck-insights__main">
        <section aria-labelledby="deck-keyword-distribution">
          <h3 id="deck-keyword-distribution" className="deck-insights__title">{tDeck('stats.keywordDistribution')}</h3>
          {distribution.length > 0
            ? <KeywordChart distribution={distribution} getKeywordLabel={getKeywordLabel} contributorsByKeyword={contributors} deployedCount={deployedIds ? identities.filter(identity => deployedIds.has(identity.id)).length : undefined} totalCount={identities.length} />
            : <p className="deck-insights__empty">{tDeck('stats.keywordEmpty')}</p>}
        </section>
        {summary}
      </div>
      <section aria-labelledby="deck-passives" className="deck-insights__passives">
        <div className="deck-insights__head">
          <h3 id="deck-passives" className="deck-insights__title">{tDeck('stats.passives')}</h3>
          <div className="deck-passive-tabs" role="group" aria-label={tDeck('stats.passives')}>
            {(['battle', 'support'] as const).map(type => (
              <button key={type} type="button" aria-pressed={passiveType === type} onClick={() => setPassiveType(type)}>
                {type === 'battle' ? tDeck('stats.battle') : tDeck('stats.support')}
              </button>
            ))}
          </div>
        </div>
        <div className="deck-insights__scroll" ref={scrollRef}>
          {groups.length === 0 ? (
            <p className="deck-insights__empty">
              {identities.length === 0 ? tDeck('stats.passiveSelectIdentity') : tDeck('stats.passiveEmpty')}
            </p>
          ) : (
            <ul className="deck-passives">
              {groups.map(({ identity, list }) => (
                <li key={identity.id} className="deck-passives__group">
                  <div className="deck-passives__head">
                    <span className="deck-passives__thumb relative block h-8 w-8 shrink-0 overflow-hidden">{identity.imageUrl && <Image src={identity.imageUrl} alt="" fill sizes="2rem" style={{ objectFit: 'cover', objectPosition: '50% 8%' }} />}</span>
                    <p className="deck-passives__who">
                      <span className="deck-passives__identity">{identity.name}</span>
                      <span className="deck-passives__sinner">{identity.sinnerName}</span>
                    </p>
                  </div>
                  <div className="deck-passives__body">
                    {list.map(({ passive, activation }, index) => {
                      const conditionPassive = asConditionPassive(passive)
                      const { requirements, met: isMet, primarySin } = getPassiveCondition(conditionPassive, sinCounts)
                      const isResonance = passive.active_cond === 'resonance'
                      // 기본 배분(3-2-1)에서는 충족하지만 현재 배분으로는 미충족이면 경고
                      const distributionWarning = !!baseSinCounts && passive.active_cond != null && !isMet && getPassiveCondition(conditionPassive, baseSinCounts).met
                      const accent = primarySin ? SIN_COLORS[primarySin] : '#888'
                      const condition = isResonance ? tDeck('stats.resonance') : tDeck('stats.stock')
                      return (
                        <div key={passive.id ?? index} className="deck-passive" data-name={passive.name} data-unmet={!!passive.active_cond && !isMet}>
                          {/* the identity page's passive name plate: each passive in a group starts on its own banner */}
                          <PassiveNameLabel>{passive.name}</PassiveNameLabel>
                          {(requirements.length > 0 || activation || distributionWarning) && <div className="deck-passive__line">
                            {requirements.length > 0 && (
                              <span className="deck-passive__cost" data-met={passive.active_cond ? isMet : undefined} title={passive.active_cond ? condition : undefined}>
                                {passive.active_cond && <span className="deck-passive__cond">{condition}</span>}
                                {requirements.map(req => (
                                  <span key={req.sin} className="deck-passive__req" data-met={passive.active_cond ? req.met : undefined}>
                                    <Image src={getSinIconUrl(req.sin)} alt={req.sin} width={18} height={18} />
                                    <span className="deck-passive__count">{passive.active_cond ? req.current + '/' + req.count : '×' + req.count}</span>
                                  </span>
                                ))}
                              </span>
                            )}
                            {activation && (
                              <span className="deck-passive__rate" data-level={activation.level} title={activationValue(activation)}>{tDeck(`stats.activation.${activation.level}`)}</span>
                            )}
                            {distributionWarning && <span className="deck-passive__warn" title={tDeck('stats.passiveWarning')}>!</span>}
                          </div>}
                          {passive.description && (
                            <div className="deck-passive__desc">
                              <SkillDescription description={passive.description} accentColor={accent} variant="detail" showCoinBadges={false} allowedKeywords={ownKeywords.get(identity.id)} matchPlainKeywords />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <style jsx global>{`
        .deck-insights { display: grid; gap: 2rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #2e2417; }
        @media (min-width: 64rem) { .deck-insights { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 3rem; } }
        .deck-insights__main { display: flex; min-width: 0; flex-direction: column; gap: 2rem; }
        .deck-insights__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
        .deck-insights__title { margin-bottom: 0.75rem; color: #e8dcc8; font-family: var(--font-heading), var(--font-sans); font-size: 1.0625rem; }
        .deck-insights__head .deck-insights__title { margin-bottom: 0; }
        .deck-insights__empty { color: #9c8b73; font-size: 0.875rem; }
        /* Passives follow the keyword column's height and scroll inside it (contain: size keeps the list from growing the row). */
        .deck-insights__passives { display: flex; min-width: 0; flex-direction: column; }
        /* No overscroll containment: at the list's ends the page goes on scrolling (useWheelIntent decides who a wheel gesture moves). */
        .deck-insights__scroll { max-height: 24rem; overflow-y: auto; padding-right: 0.75rem; }
        .deck-insights__scroll::-webkit-scrollbar { width: 4px; }
        .deck-insights__scroll::-webkit-scrollbar-track { background: transparent; }
        .deck-insights__scroll::-webkit-scrollbar-thumb { background: #3a2c18; border-radius: 4px; }
        .deck-insights__scroll:hover::-webkit-scrollbar-thumb { background: #6b5024; }
        @media (min-width: 64rem) {
          .deck-insights__passives { min-height: 16rem; }
          .deck-insights__scroll { flex: 1 1 0; min-height: 0; max-height: none; contain: size; }
        }
        .deck-passive-tabs { display: inline-flex; padding: 0.1875rem; border: 1px solid #2e2417; border-radius: 0.375rem; background: #120e08; }
        .deck-passive-tabs button { min-height: 2rem; padding: 0 0.875rem; border-radius: 0.25rem; color: #9c8b73; cursor: pointer; font-size: 0.8125rem; transition: color 0.15s ease, background-color 0.15s ease; }
        .deck-passive-tabs button:hover { color: #e8dcc8; }
        .deck-passive-tabs button[aria-pressed='true'] { background: #2a2014; color: #e8dcc8; font-weight: 600; }
        .deck-passive-tabs button:focus-visible { outline: 2px solid #e8b030; outline-offset: 1px; }
        @media (pointer: coarse) { .deck-passive-tabs button { min-height: 2.5rem; } }
        @media (prefers-reduced-motion: reduce) { .deck-passive-tabs button { transition: none; } }
        .deck-passives { display: flex; flex-direction: column; list-style: none; }
        .deck-passives__group { display: flex; flex-direction: column; gap: 0.625rem; padding: 1rem 0; border-top: 1px solid #221a10; }
        .deck-passives__group:first-child { border-top: 0; padding-top: 0; }
        .deck-passives__head { display: flex; min-width: 0; align-items: center; gap: 0.625rem; }
        .deck-passives__thumb { position: relative; flex: 0 0 auto; width: 2rem; aspect-ratio: 1; overflow: hidden; border: 1px solid #2e2417; border-radius: 0.25rem; background: #120e08; }
        .deck-passives__thumb img { object-fit: cover; object-position: 50% 8%; }
        .deck-passives__who { display: flex; min-width: 0; flex-wrap: wrap; align-items: baseline; gap: 0 0.5rem; line-height: 1.35; }
        .deck-passives__identity { color: #e8dcc8; font-size: 0.875rem; font-weight: 600; }
        .deck-passives__sinner { color: #9c8b73; font-size: 0.8125rem; }
        .deck-passives__body { display: flex; min-width: 0; flex-direction: column; gap: 0.75rem; }
        @media (min-width: 40rem) { .deck-passives__body { padding-left: 2.625rem; } }
        .deck-passive__line { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem 0.5rem; margin-bottom: 0.25rem; }
        .deck-passive + .deck-passive { padding-top: 0.75rem; border-top: 1px solid #221a10; }
        .deck-passive[data-unmet='true'] [data-skill-name-banner] { opacity: 0.55; }
        .deck-passive h4 { margin-bottom: 0.375rem; }
        .deck-passive__cost {
          display: inline-flex; align-items: center; gap: 0.25rem; min-height: 1.5rem; padding: 0 0.5rem 0 0.3125rem;
          border: 1px solid #3a2c18; border-radius: 0.25rem; background: #120e08; color: #e8dcc8; font-size: 0.8125rem;
        }
        .deck-passive__req { display: inline-flex; align-items: center; gap: 0.25rem; }
        .deck-passive__req + .deck-passive__req { margin-left: 0.25rem; }
        .deck-passive__cost img { width: 1.125rem; height: 1.125rem; }
        .deck-passive__cost[data-met='false'] { border-color: rgba(155,44,35,0.7); background: rgba(155,44,35,0.12); }
        .deck-passive__req[data-met='false'] img { opacity: 0.55; filter: grayscale(0.6); }
        .deck-passive__cond { margin-right: 0.125rem; color: #9c8b73; font-size: 0.75rem; }
        .deck-passive__count { font-variant-numeric: tabular-nums; }
        .deck-passive__req[data-met='false'] .deck-passive__count { color: #e07060; }
        .deck-passive__desc > div { color: #c9b99c !important; font-size: 0.875rem !important; line-height: 1.65 !important; }
        .deck-passive__rate { display: inline-flex; align-items: center; min-height: 1.5rem; padding: 0 0.5rem; border-radius: 0.25rem; background: var(--bg-elevated); color: var(--text-secondary); font-size: 0.75rem; font-weight: 600; }
        .deck-passive__rate[data-level='easy'] { background: color-mix(in srgb, var(--gold-light) 14%, transparent); color: var(--gold-light); }
        .deck-passive__rate[data-level='hard'] { background: color-mix(in srgb, #9b2c23 30%, transparent); color: var(--error-text); }
        .deck-passive__rate[data-level='impossible'] { background: #9b2c23; color: var(--text-primary); }
        .deck-passive__warn { display: inline-flex; width: 1.25rem; height: 1.25rem; align-items: center; justify-content: center; border-radius: 999px; background: #9b2c23; color: #e8dcc8; font-size: 0.75rem; font-weight: 700; }
      `}</style>
    </div>
  )
}
