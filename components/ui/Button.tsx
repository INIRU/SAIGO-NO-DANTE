import type { ComponentProps } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerSolid'
type ButtonSize = 'sm' | 'md'

const BASE = 'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-lg)] border font-semibold '
  + 'transition-[transform,background-color,border-color,color,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] '
  + 'active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] '
  + 'disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:active:scale-100'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-[var(--gold)] bg-[var(--gold)] text-[var(--bg-deep)] not-disabled:hover:border-[var(--gold-light)] not-disabled:hover:bg-[var(--gold-light)]',
  secondary: 'border-white/[0.06] bg-white/[0.04] text-[var(--text-primary)] not-disabled:hover:border-white/[0.1] not-disabled:hover:bg-white/[0.08]',
  outline: 'border-[var(--border-gold)] bg-transparent text-[var(--gold-light)] not-disabled:hover:border-[var(--gold)] not-disabled:hover:bg-[var(--gold)]/10',
  ghost: 'border-transparent bg-transparent text-[var(--text-secondary)] not-disabled:hover:bg-white/[0.05] not-disabled:hover:text-[var(--text-primary)]',
  danger: 'border-[var(--error)]/40 bg-[var(--error)]/10 text-[#e58a80] not-disabled:hover:border-[var(--error)]/70 not-disabled:hover:bg-[var(--error)]/20',
  // The last press of something that cannot be undone (e.g. confirming a suspension).
  dangerSolid: 'border-[var(--error)] bg-[var(--error)] text-white not-disabled:hover:brightness-110',
}

// md is the 44px touch target; sm is for dense toolbars and rows.
const SIZES: Record<ButtonSize, { text: string; square: string }> = {
  sm: { text: 'min-h-9 px-3 text-[var(--text-sm)]', square: 'h-9 w-9' },
  md: { text: 'min-h-11 px-4 text-[0.875rem]', square: 'h-11 w-11' },
}

/** The shared button look, for links and other elements that act as buttons. */
export function buttonClass({ variant = 'secondary', size = 'md', iconOnly = false }: { variant?: ButtonVariant; size?: ButtonSize; iconOnly?: boolean } = {}) {
  return `${BASE} ${VARIANTS[variant]} ${iconOnly ? SIZES[size].square : SIZES[size].text}`
}

// ComponentProps includes `ref` (a plain prop in React 19), passed through with the rest.
type Props = ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  /** Disables the button and shows a spinner in place of the icon while an action runs. */
  loading?: boolean
}

/** Icon-only buttons (no children) must pass `aria-label`. */
export default function Button({ variant, size = 'md', icon: Icon, loading = false, className = '', children, type = 'button', disabled, ...rest }: Props) {
  const iconOnly = children === undefined || children === null
  const iconSize = size === 'sm' ? 15 : 17
  return (
    <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`${buttonClass({ variant, size, iconOnly })} ${loading ? 'disabled:opacity-80' : ''} ${className}`}>
      {loading
        ? <Loader2 size={iconSize} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        : Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
    </button>
  )
}
