import DanteLogo from '@/components/brand/DanteLogo'

/**
 * Static stand-in for the navbar while it streams on routes whose pathname is request data (e.g. /decks/[id]).
 * Same bar, height and brand as Navbar so the page does not paint without a header and then pop one in.
 */
export default function NavbarFallback({ siteName }: { siteName: string }) {
  return (
    <div aria-hidden="true" className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--bg-deep)]">
      <div className="max-w-7xl mx-auto h-16 px-4 md:px-6 flex items-center">
        <span className="flex shrink-0 items-center gap-2 text-[1.0625rem] md:text-[1.1875rem] text-[var(--gold)]" style={{ fontFamily: 'var(--font-heading)' }}>
          <DanteLogo size="2.25rem" className="-ml-1 md:h-10 md:w-10" />
          {siteName}
        </span>
      </div>
    </div>
  )
}
