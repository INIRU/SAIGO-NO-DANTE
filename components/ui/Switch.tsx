/**
 * An on/off setting. `label` names it for screen readers when no visible label points at it (`id` + `<label htmlFor>`).
 */
export default function Switch({ checked, onChange, label, disabled = false, id }: {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  disabled?: boolean
  id?: string
}) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-45 ${checked ? 'border-[var(--gold)] bg-[var(--gold)]' : 'border-white/10 bg-white/[0.08] hover:bg-white/[0.12]'}`}>
      <span aria-hidden="true"
        className={`ml-[3px] h-5 w-5 rounded-full shadow-[0_0.0625rem_0.1875rem_rgba(0,0,0,0.45)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${checked ? 'translate-x-5 bg-[var(--bg-deep)]' : 'translate-x-0 bg-[var(--text-secondary)]'}`} />
    </button>
  )
}
