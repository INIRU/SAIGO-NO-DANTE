import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import BaseModal from './BaseModal'
import Button from './Button'

/**
 * A panel docked to the bottom edge on phones (centred above 640px): the title and close button stay put while the
 * body scrolls. Esc and a tap outside close it.
 */
export default function Sheet({ open, onClose, title, closeLabel, children, footer }: {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
  /** Actions pinned under the scrolling body. */
  footer?: ReactNode
}) {
  return (
    <BaseModal open={open} onClose={onClose} title={title} sheet maxWidth="40rem" initialFocus="dialog">
      <div className="flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[var(--border)] bg-[var(--bg-card)] shadow-[0_-0.75rem_2.5rem_rgba(0,0,0,0.5)] sm:rounded-2xl sm:border-b">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2 pl-5 pr-2">
          <h2 className="font-[family-name:var(--font-heading)] text-[1rem] text-[var(--text-primary)]">{title}</h2>
          <Button variant="ghost" icon={X} aria-label={closeLabel} onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <footer className="border-t border-white/[0.06] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </BaseModal>
  )
}
