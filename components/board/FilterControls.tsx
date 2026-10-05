'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { ChevronDown, Info, X } from 'lucide-react'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import styles from './FilterControls.module.css'

export { styles as filterStyles }

/**
 * One filter of a board's filter column: its name over a thin rule, how many are chosen, and tools at the end of the
 * rule (clear, and/or, pick). With `onToggle` the name folds the section.
 */
export function FilterSection({ label, count = 0, open = true, onToggle, end, children }: {
  label: ReactNode; count?: number; open?: boolean; onToggle?: () => void; end?: ReactNode; children?: ReactNode
}) {
  // A label that brings its own controls (the info score's help) lays itself out: clipping it here would cut their focus ring.
  const title = <>
    {typeof label === 'string' ? <span className="truncate">{label}</span> : label}
    {count > 0 && <b className={styles.count}>{count}</b>}
  </>
  return (
    <section>
      <div className={styles.head}>
        <h3 className={styles.title}>
          {onToggle
            ? <button type="button" aria-expanded={open} onClick={onToggle}>{title}<ChevronDown size={14} className={styles.chevron} aria-hidden="true" /></button>
            : title}
        </h3>
        {end}
      </div>
      {open && children && <div className={styles.body}>{children}</div>}
    </section>
  )
}

/** A small tool at the end of a section's rule: "지우기", "하나라도 / 모두", "고르기". */
export function FilterTextButton({ accent, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { accent?: boolean }) {
  return <button type="button" {...props} className={styles.textButton} data-accent={accent || undefined} />
}

/** One choice among a few, as plain text; `tone` is the choice's own colour when it has one (a difficulty, a content type). */
export function FilterChoice({ active, tone, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean; tone?: string }) {
  return <button type="button" {...props} aria-pressed={active} className={styles.choice} style={active && tone ? { color: tone } : undefined}><span>{children}</span></button>
}

/**
 * The search syntax of a board's search field, behind a help mark at the field's end: the line it used to take under
 * the field pushed the column out of step with the list beside it. The text shows while the mark is hovered or holds
 * the focus (a tap gives it the focus), over the page, so nothing moves.
 */
export function FilterFieldHelp({ text }: { text: string }) {
  return <button type="button" aria-label={text} className={styles.help}><Info size={15} aria-hidden="true" /><span role="tooltip">{text}</span></button>
}

/** A keyword as a tile: its icon over its name. Five to a row, all one size. */
export function FilterIconTile({ active, label, iconUrl, onClick }: { active: boolean; label: string; iconUrl?: string | null; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={active} title={label} className={styles.tile} onClick={onClick}>
      {iconUrl && <Image src={iconUrl} alt="" width={24} height={24} />}
      <span>{label}</span>
    </button>
  )
}

/** Something chosen in a picker, listed under its section; pressing it takes it off. */
export function FilterPicked({ label, removeLabel, image, imageClassName = 'object-cover', thumbClassName = '', onRemove }: {
  label: string; removeLabel: string; image?: string | null; imageClassName?: string; thumbClassName?: string; onRemove: () => void
}) {
  return (
    <button type="button" className={styles.picked} aria-label={removeLabel} onClick={onRemove}>
      {image && <span className={`${styles.thumb} ${thumbClassName}`}><Image src={image} alt="" fill sizes="28px" className={imageClassName} /></span>}
      <span>{label}</span>
      <X size={14} aria-hidden="true" />
    </button>
  )
}

/**
 * The identity filter's way in: one tile per sinner, six to a row, each opening that sinner's identities. A sinner whose
 * identity is chosen (the filter keeps one per sinner) shows that identity instead of the logo.
 */
export function FilterSinnerTiles<S extends { id: string }, T>({ sinners, picked, image, label, onOpen, groupLabel }: {
  sinners: readonly S[]
  picked: ReadonlyMap<string, T[]>
  image: (identity: T) => string | null
  /** What the tile is called for a screen reader, with how many of the sinner's identities are chosen. */
  label: (sinner: S, count: number) => string
  onOpen: (sinnerId: string) => void
  groupLabel: string
}) {
  return (
    <div className={styles.sinners} role="group" aria-label={groupLabel}>
      {sinners.map(sinner => {
        const chosen = picked.get(sinner.id) ?? []
        const portrait = chosen[0] ? image(chosen[0]) : null
        return (
          <button key={sinner.id} type="button" className={styles.sinner} data-picked={chosen.length > 0 || undefined} aria-haspopup="dialog"
            aria-label={label(sinner, chosen.length)} onClick={() => onOpen(sinner.id)}>
            {portrait
              ? <span className={styles.sinnerPortrait}><Image src={portrait} alt="" fill sizes="3rem" /></span>
              : <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={44} height={44} className={styles.sinnerLogo} />}
          </button>
        )
      })}
    </div>
  )
}
