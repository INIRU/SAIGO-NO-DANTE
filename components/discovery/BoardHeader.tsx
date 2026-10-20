import { ArrowLeft, Play, Plus, SlidersHorizontal } from 'lucide-react'
import NoteEditorGuide from '@/components/notes/NoteEditorGuide'
import { Link } from '@/lib/i18n/navigation'

const press = 'active:scale-[0.97] motion-reduce:active:scale-100 transition-[transform,background-color,filter] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]'

/**
 * The deck and plan boards' header: the title with the all-posts and create buttons beside it (icons only on a phone).
 * While the full list is open the all-posts button gives way to the way back to the shelves.
 * `assist` (planner board only) opens Assist Mode setup without a plan; an unfinished run resumes as usual.
 */
export default function BoardHeader({ kind, title, action, viewAll, back, assist }: {
  kind: 'deck' | 'planner'; title: string; action: string; viewAll: string; back: string; assist?: string
}) {
  const board = kind === 'deck' ? '/decks' : '/planner/community'
  return (
    <header className="board-header mx-auto w-full max-w-7xl shrink-0 px-4 pb-5 pt-[5.25rem] md:px-6 md:pb-7 md:pt-[6.5rem]">
      <div className="flex items-center gap-2 md:gap-3">
        <h1 className="min-w-0 flex-1 break-keep font-[family-name:var(--font-heading)] text-[1.625rem] leading-none text-[var(--gold)] md:text-[2.25rem]">{title}</h1>
        <div className="hidden md:block"><NoteEditorGuide compact /></div>
        {assist && (
          <Link href="/planner/run?entry=board" data-board-assist aria-label={assist} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--border-gold)] px-3 text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] ${press}`}>
            <Play size={16} aria-hidden="true" /><span className="hidden whitespace-nowrap text-[1rem] font-semibold lg:inline">{assist}</span>
          </Link>
        )}
        <Link href={`${board}?browse=all`} aria-label={viewAll} className={`[.community-board:has([data-board-browse])_&]:hidden flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#3a2a15] bg-[#17120c] px-3 text-[var(--text-primary)] [@media(hover:hover)]:hover:border-[#5a4526] ${press}`}>
          <SlidersHorizontal size={17} aria-hidden="true" /><span className="hidden whitespace-nowrap text-[1rem] font-semibold md:inline">{viewAll}</span>
        </Link>
        <Link href={board} aria-label={back} data-board-back className={`hidden [.community-board:has([data-board-browse])_&]:flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[#3a2a15] bg-[#17120c] px-3 text-[var(--text-primary)] [@media(hover:hover)]:hover:border-[#5a4526] ${press}`}>
          <ArrowLeft size={17} aria-hidden="true" /><span className="hidden whitespace-nowrap text-[1rem] font-semibold md:inline">{back}</span>
        </Link>
        <Link href={kind === 'deck' ? '/decks/new' : '/planner'} aria-label={action} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--gold)] px-3 text-[var(--bg-deep)] [@media(hover:hover)]:hover:brightness-110 ${press}`}>
          <Plus size={18} aria-hidden="true" /><span className="hidden whitespace-nowrap text-[1rem] font-semibold sm:inline">{action}</span>
        </Link>
      </div>
    </header>
  )
}
