'use client'

import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type MouseEvent } from 'react'
import ThemePackCard from '@/components/ui/ThemePackCard'
import styles from './ThemePackStack.module.css'

type CardProps = ComponentProps<typeof ThemePackCard>

/**
 * A floor's theme packs as one stack: the first choice in front, its fallbacks the same size behind it, each peeking
 * out on the right. A mouse over it, keyboard focus or a tap on the peeking edge fans the fallbacks out; a tap outside
 * folds them back. The card width comes from `--w` on an ancestor.
 */
export default function ThemePackStack({ themes, lang, sizes, ariaLabel, onClick }: {
  /** First choice first. */
  themes: CardProps['theme'][]
  lang?: CardProps['lang']
  sizes?: string
  /** Accessible name of the first-choice card. */
  ariaLabel?: string
  /** Click on any card once the stack is open (or has no fallbacks). Without it the cards only fan out. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const [first, ...alts] = themes
  if (!first) return null
  return (
    <div
      ref={root}
      className={styles.stack}
      data-theme-stack={alts.length}
      data-open={open || undefined}
      style={{ '--n': alts.length } as CSSProperties}
      // Touch has no hover: there the peeking edge is the way in (see the fallback's click below).
      onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') setOpen(false) }}
      onFocus={event => { if (event.target.matches(':focus-visible')) setOpen(true) }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    >
      {alts.map((alt, index) => (
        <div key={String(alt.id)} className={styles.alt} style={{ '--i': index + 1, zIndex: alts.length - index } as CSSProperties}>
          <ThemePackCard
            theme={alt}
            lang={lang}
            sizes={sizes}
            onClick={event => {
              if (open && onClick) return onClick(event)
              event.stopPropagation()
              setOpen(!open)
            }}
          />
        </div>
      ))}
      <div className={styles.first}>
        <ThemePackCard
          theme={first}
          lang={lang}
          sizes={sizes}
          ariaLabel={ariaLabel}
          onClick={event => {
            if (onClick) return onClick(event)
            event.stopPropagation()
            setOpen(alts.length > 0 && !open)
          }}
        />
      </div>
    </div>
  )
}
