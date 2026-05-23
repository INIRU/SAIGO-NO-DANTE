'use client'

import { useLocale } from 'next-intl'
import { useMemo } from 'react'
import TierCardInteractive, { type TierIdentity } from './TierCardInteractive'
import {
  REROLL_TIERS,
  REROLL_TIER_COLORS,
  REROLL_TIER_LABELS,
  REROLL_TIER_SCORES,
  type RerollTier,
  type SupportedTierLocale,
} from './rerollTier'

type SupportedLocale = SupportedTierLocale

const TIER_GRID_MAX_WIDTH = '64rem'

const EMPTY_COPY: Record<SupportedLocale, string> = {
  ko: '배정된 인격이 없습니다.',
  en: 'No identities assigned.',
  ja: '配置された人格がありません。',
}

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'en' || locale === 'ja' ? locale : 'ko'
}

function getLocalizedIdentityName(identity: TierIdentity, locale: SupportedLocale) {
  if (locale === 'en') return identity.name_en ?? identity.name ?? identity.name_kr ?? identity.name_jp ?? ''
  if (locale === 'ja') return identity.name_jp ?? identity.name ?? identity.name_kr ?? identity.name_en ?? ''
  return identity.name_kr ?? identity.name ?? identity.name_en ?? identity.name_jp ?? ''
}

function compareTierIdentities(locale: SupportedLocale) {
  return (a: TierIdentity, b: TierIdentity) => getLocalizedIdentityName(a, locale).localeCompare(getLocalizedIdentityName(b, locale), locale)
}

function getTierTextColor(tier: RerollTier): string {
  return tier === 'A' ? '#241900' : '#fff'
}

function getTierSubtextColor(tier: RerollTier): string {
  return tier === 'A' ? '#3a2800' : '#fff1d6'
}

export default function TierGrid({
  tiers,
  diagnosisMode = false,
  selectedDiagnosisIds,
  onToggleDiagnosis,
}: {
  tiers: Record<RerollTier, TierIdentity[]>
  diagnosisMode?: boolean
  selectedDiagnosisIds?: Set<string>
  onToggleDiagnosis?: (identityId: string) => void
}) {
  const locale = normalizeLocale(useLocale())
  const tierRows = useMemo(() => {
    const renderedIdentityIds = new Set<string>()

    return REROLL_TIERS.map(tier => {
      const tierIdentities = [...(tiers[tier] ?? [])]
        .filter(identity => {
          if (renderedIdentityIds.has(identity.id)) return false
          renderedIdentityIds.add(identity.id)
          return true
        })
        .sort(compareTierIdentities(locale))

      return { tier, tierIdentities }
    })
  }, [locale, tiers])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
      <style>{`
        .tier-identity-card-shell {
          position: relative;
          border-radius: 0.5rem;
          transition: transform 0.18s ease, filter 0.18s ease;
          transform-origin: center center;
        }
        .tier-identity-cell:hover .tier-identity-card-shell,
        .tier-identity-cell:focus-visible .tier-identity-card-shell {
          transform: scale(1.04);
        }
        .tier-identity-card-shell > [data-rarity] {
          pointer-events: none;
        }
        .tier-diagnosis-selected-overlay {
          position: absolute;
          inset: 0;
          z-index: 9;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          background: rgba(13,11,8,0.48);
          backdrop-filter: brightness(0.72) saturate(0.9);
          pointer-events: none;
        }
        .tier-diagnosis-selected-label {
          color: #e8b030;
          font-size: 1rem;
          font-weight: 800;
          line-height: 1;
          text-shadow: 0 0 0.75rem rgba(200,144,10,0.68), 0 0.125rem 0.5rem rgba(0,0,0,0.9);
        }
        .tier-identity-cell[data-diagnosis-mode="true"] {
          cursor: crosshair;
        }
        @media (max-width: 47.999rem) {
          .tier-row {
            grid-template-columns: minmax(0, 1fr) !important;
            row-gap: 0.5rem !important;
          }
          .tier-label-rail {
            position: relative !important;
            top: auto !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 0.375rem !important;
            width: auto !important;
            max-width: 100% !important;
            margin-bottom: 0.125rem !important;
          }
          .tier-label-block {
            width: auto !important;
            min-height: 2.25rem !important;
            flex-direction: row !important;
            justify-content: flex-start !important;
            gap: 0.5rem !important;
            padding: 0 0.625rem !important;
            font-size: 0.9375rem !important;
          }
          .tier-label-score {
            margin-top: 0 !important;
            font-size: 0.875rem !important;
            white-space: nowrap !important;
          }
          .tier-label-guide {
            display: block !important;
            flex: 0 1 8rem !important;
            width: 8rem !important;
            max-width: min(8rem, 38vw) !important;
            min-width: 2.5rem !important;
            height: 0.0625rem !important;
          }
          .tier-connector-line {
            display: none !important;
          }
          .tier-row-content {
            min-width: 0 !important;
          }
          .tier-card-grid {
            width: 100% !important;
            margin: 0 auto !important;
            grid-template-columns: minmax(0, 6.25rem) minmax(0, 6.25rem) minmax(0, 6.25rem) !important;
            justify-content: center !important;
            gap: 1rem 0.625rem !important;
            padding: 0.25rem 0 0.875rem !important;
          }
        }
      `}</style>
      {tierRows.map(({ tier, tierIdentities }) => {
        const labelColor = getTierTextColor(tier)
        const labelSubtextColor = getTierSubtextColor(tier)

        return (
          <section
            key={tier}
            data-tier-row={tier}
            className="tier-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(3.75rem, 4.5rem) minmax(0, 1fr)',
              columnGap: '1rem',
              alignItems: 'start',
            }}
          >
            <div
              className="tier-label-rail"
              style={{
                position: 'sticky',
                top: '5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '0.5rem',
              }}
            >
              <div
                className="tier-label-block"
                aria-label={`${tier} ${REROLL_TIER_LABELS[locale][tier]} +${REROLL_TIER_SCORES[tier].toFixed(1)}`}
                style={{
                  width: '100%',
                  minHeight: '3.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: REROLL_TIER_COLORS[tier],
                  borderRadius: '0.375rem',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: labelColor,
                  textShadow: labelColor === '#fff' ? '0 1px 3px rgba(0,0,0,0.38)' : 'none',
                }}
              >
                <span aria-hidden="true">{tier}</span>
                <span
                  aria-hidden="true"
                  className="tier-label-score"
                  style={{
                    color: labelSubtextColor,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9375rem',
                    fontWeight: 800,
                    lineHeight: 1.2,
                    marginTop: '0.125rem',
                  }}
                >
                  +{REROLL_TIER_SCORES[tier].toFixed(1)}
                </span>
              </div>
              <div
                className="tier-label-guide"
                aria-hidden="true"
                style={{
                  display: 'none',
                  height: '0.0625rem',
                  width: '8rem',
                  maxWidth: '38vw',
                  background: `linear-gradient(90deg, ${REROLL_TIER_COLORS[tier]}99, ${REROLL_TIER_COLORS[tier]}33 45%, transparent 100%)`,
                }}
              />
              <div
                className="tier-connector-line"
                style={{
                  width: '0.0625rem',
                  minHeight: '4rem',
                  alignSelf: 'center',
                  background: `linear-gradient(to bottom, ${REROLL_TIER_COLORS[tier]}66, transparent)`,
                }}
              />
            </div>

            <div className="tier-row-content">
              {tierIdentities.length > 0 ? (
                <div
                  className="tier-card-grid"
                  style={{
                    display: 'grid',
                    width: `min(100%, ${TIER_GRID_MAX_WIDTH})`,
                    margin: '0 auto',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 8.5rem), 9.25rem))',
                    justifyContent: 'start',
                    alignItems: 'start',
                    gap: '1.375rem 1.125rem',
                    padding: '0.25rem 0.25rem 0.875rem',
                    position: 'relative',
                    zIndex: 0,
                    overflow: 'visible',
                  }}
                >
                  {tierIdentities.map(identity => (
                    <TierCardInteractive
                      key={`${tier}-${identity.id}`}
                      identity={identity}
                      diagnosisMode={diagnosisMode && Boolean(onToggleDiagnosis)}
                      diagnosisSelected={selectedDiagnosisIds?.has(identity.id) ?? false}
                      onToggleDiagnosis={onToggleDiagnosis}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    minHeight: '4rem',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.875rem 1rem',
                    border: '1px dashed rgba(200,144,10,0.18)',
                    borderRadius: '0.5rem',
                    background: 'rgba(20,16,12,0.46)',
                    color: '#8a7855',
                    fontSize: '0.9375rem',
                  }}
                >
                  {EMPTY_COPY[locale]}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
