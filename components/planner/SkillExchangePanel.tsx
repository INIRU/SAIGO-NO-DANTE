'use client'

import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'

export const SKILL_EXCHANGE_PRESETS: [number, number, number][] = [[3, 2, 1], [1, 0, 5], [0, 0, 6]]

export type SkillExchangeSkill = {
  name?: string | null
  iconSrc?: string | null
  sinColor?: string | null
}

type SkillExchangePanelProps = {
  distribution: [number, number, number]
  skills: [SkillExchangeSkill | null, SkillExchangeSkill | null, SkillExchangeSkill | null]
  /** Row header: square portrait crop + names. */
  identity?: { imageUrl?: string | null; name: string; sinnerName?: string }
  /** Makes the portrait + names a button (plan detail opens the identity preview). */
  onIdentityClick?: () => void
  showTotal?: boolean
  readOnly?: boolean
  canDecrease?: (idx: number) => boolean
  canIncrease?: (idx: number) => boolean
  onAdjust?: (idx: number, delta: number) => void
  onPresetSelect?: (preset: [number, number, number]) => void
}

/** One sinner per row: portrait, names, S1–S3 with counts (and steppers), total and presets. Wrap rows in .skill-exchange-list. */
export default function SkillExchangePanel({
  distribution,
  skills,
  identity,
  onIdentityClick,
  showTotal = true,
  readOnly = false,
  canDecrease,
  canIncrease,
  onAdjust,
  onPresetSelect,
}: SkillExchangePanelProps) {
  const total = distribution[0] + distribution[1] + distribution[2]
  const mayDecrease = (idx: number) => canDecrease?.(idx) ?? distribution[idx] > 0
  const mayIncrease = (idx: number) => canIncrease?.(idx) ?? total < 6
  const who = identity && (
    <>
      <span className="skx__thumb">
        {identity.imageUrl && <Image src={identity.imageUrl} alt="" fill sizes="2.75rem" />}
      </span>
      <span className="skx__names">
        {identity.sinnerName && <span className="skx__sinner">{identity.sinnerName}</span>}
        <span className="skx__identity">{identity.name}</span>
      </span>
    </>
  )

  return (
    <div className="skx" data-readonly={readOnly || undefined}>
      {who && (onIdentityClick
        ? <button type="button" className="skx__who" onClick={onIdentityClick}>{who}</button>
        : <div className="skx__who">{who}</div>)}

      {!readOnly && showTotal && (
        <span className="skx__total" data-ok={total === 6} aria-live="polite">
          {total}<span>/6</span>
        </span>
      )}

      <div className="skx__skills">
        {[0, 1, 2].map(idx => {
          const skill = skills[idx]
          const label = skill?.name ? `S${idx + 1} ${skill.name}` : `S${idx + 1}`
          return (
            <div key={idx} className="skx__skill" title={label}>
              <span className="skx__icon" style={{ borderBottomColor: skill?.sinColor ?? '#2e2417' }}>
                {skill?.iconSrc ? (
                  <ImageWithFallback src={skill.iconSrc} alt={label} width={32} height={32} fallbackType="skill" />
                ) : (
                  <span className="skx__slot">S{idx + 1}</span>
                )}
              </span>
              {!readOnly && (
                <button type="button" className="skx__step" onClick={() => onAdjust?.(idx, -1)} disabled={!mayDecrease(idx)} aria-label={`${label} -`}>&#x2212;</button>
              )}
              <span className="skx__count" data-zero={distribution[idx] === 0}>{distribution[idx]}</span>
              {!readOnly && (
                <button type="button" className="skx__step" onClick={() => onAdjust?.(idx, 1)} disabled={!mayIncrease(idx)} aria-label={`${label} +`}>+</button>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <div className="skx__presets">
          {SKILL_EXCHANGE_PRESETS.map(preset => {
            const active = distribution[0] === preset[0] && distribution[1] === preset[1] && distribution[2] === preset[2]
            return (
              <button key={preset.join(',')} type="button" aria-pressed={active} onClick={() => onPresetSelect?.(preset)}>
                {preset.join('-')}
              </button>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .skx {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          grid-template-areas: "who who total" "skills skills skills" "presets presets presets";
          align-items: center;
          gap: 0.5rem 0.75rem;
          padding: 0.75rem 0;
          border-top: 1px solid #2e2417;
        }
        .skx[data-readonly] { grid-template-areas: "who skills skills"; }
        .skx > :global(.skx__who) {
          grid-area: who; display: flex; min-width: 0; align-items: center; gap: 0.625rem;
          padding: 0; border: 0; background: none; color: inherit; text-align: left; font: inherit;
        }
        .skx > :global(button.skx__who) { cursor: pointer; border-radius: 0.25rem; }
        .skx > :global(button.skx__who:hover .skx__identity) { color: #e8b030; }
        .skx :global(.skx__thumb) { position: relative; flex: 0 0 auto; width: 2.75rem; height: 2.75rem; overflow: hidden; border-radius: 0.25rem; background: #17120c; box-shadow: inset 0 0 0 1px #2e2417; }
        .skx :global(.skx__thumb img) { object-fit: cover; object-position: 50% 10%; }
        .skx :global(.skx__names) { display: flex; min-width: 0; flex-direction: column; }
        .skx :global(.skx__sinner) { color: #9c8b73; font-size: 0.75rem; line-height: 1.35; }
        .skx :global(.skx__identity) { overflow: hidden; color: #e8dcc8; font-size: 0.875rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; transition: color 150ms ease; }
        .skx__total { grid-area: total; color: #e0604f; font-family: var(--font-title), var(--font-sans); font-size: 1.375rem; line-height: 1; font-variant-numeric: tabular-nums; }
        .skx__total span { color: inherit; opacity: 0.6; font-size: 0.9375rem; }
        .skx__total[data-ok="true"] { color: #e8dcc8; }
        .skx__total[data-ok="true"] span { color: #7f7364; opacity: 1; }
        .skx__skills { grid-area: skills; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
        .skx[data-readonly] .skx__skills { justify-content: flex-end; gap: 1rem; }
        .skx__skill { display: flex; align-items: center; gap: 0.25rem; }
        .skx__icon { display: flex; width: 2rem; height: 2rem; flex: 0 0 auto; align-items: center; justify-content: center; margin-right: 0.125rem; border-bottom: 2px solid; }
        .skx__icon :global(img) { width: 1.875rem; height: 1.875rem; }
        .skx__slot { color: #7f7364; font-size: 0.6875rem; }
        .skx__step {
          display: flex; width: 1.5rem; height: 1.5rem; align-items: center; justify-content: center; padding: 0;
          border: 0; border-radius: 0.25rem; background: #1d1710; color: #9c8b73;
          cursor: pointer; font-size: 0.875rem; line-height: 1; transition: background-color 150ms ease, color 150ms ease;
        }
        .skx__step:hover:not(:disabled) { background: rgba(200,144,10,0.16); color: #e8b030; }
        .skx__step:disabled { background: transparent; color: #3a2e1e; cursor: not-allowed; }
        .skx__count { min-width: 1rem; color: #e8dcc8; font-family: var(--font-title), var(--font-sans); font-size: 1.25rem; line-height: 1; text-align: center; }
        .skx__count[data-zero="true"] { color: #5a4a34; }
        .skx__presets { grid-area: presets; display: flex; gap: 0.25rem; }
        .skx__presets button {
          min-height: 1.5rem; padding: 0 0.5rem; border: 1px solid #2e2417; border-radius: 0.25rem;
          background: transparent; color: #8a7a63; cursor: pointer; font-size: 0.75rem; font-variant-numeric: tabular-nums;
          transition: border-color 150ms ease, color 150ms ease;
        }
        .skx__presets button:hover { border-color: #5a4526; color: #e8dcc8; }
        .skx__presets button[aria-pressed="true"] { border-color: rgba(200,144,10,0.55); background: rgba(200,144,10,0.08); color: #e8b030; }
        .skx button:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
        @media (min-width: 40rem) {
          .skx { grid-template-columns: auto minmax(0, 1fr) auto auto; grid-template-areas: "who who presets total" "skills skills skills skills"; }
          .skx__skills { justify-content: flex-start; gap: 1.25rem; }
        }
        @media (pointer: coarse) {
          .skx__step { width: 2rem; height: 2rem; }
          .skx__presets button { min-height: 2rem; padding: 0 0.625rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .skx :global(.skx__identity), .skx__step, .skx__presets button { transition: none; }
        }
      `}</style>
      <style jsx global>{`
        .skill-exchange-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, max(26rem, calc(50% - 1.25rem))), 1fr)); column-gap: 2.5rem; border-bottom: 1px solid #2e2417; }
      `}</style>
    </div>
  )
}

