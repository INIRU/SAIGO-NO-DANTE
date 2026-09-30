import { placeholderLabel, type PlaceholderToken } from '@/lib/game-text/placeholders'

/** A value the game fills in while playing ({{live}}, {{potency}} … in DB text), shown as a small inline label. */
export default function PlaceholderLabel({ token, locale }: { token: PlaceholderToken; locale: string }) {
  return (
    <span
      data-placeholder={token}
      className="inline-block rounded-[0.1875rem] align-baseline whitespace-nowrap"
      style={{
        padding: '0 0.3125rem',
        margin: '0 0.0625rem',
        fontSize: '0.86em',
        lineHeight: 1.45,
        fontWeight: 600,
        color: 'var(--gold-light)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      {placeholderLabel(token, locale)}
    </span>
  )
}
