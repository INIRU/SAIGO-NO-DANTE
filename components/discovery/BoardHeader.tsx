import NoteEditorGuide from '@/components/notes/NoteEditorGuide'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'

export default function BoardHeader({ kind, lang, title, subtitle, eyebrow, action }: {
  kind: 'deck' | 'planner'; lang: string; title: string; subtitle: string; eyebrow: string; action: string
}) {
  const back = lang === 'ko' ? `${title}으로` : lang === 'ja' ? `${title}に戻る` : `Back to ${title}`
  return (
    <header className="board-header mx-auto w-full max-w-7xl shrink-0 px-4 font-[family-name:var(--font-paperlogy)] md:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="board-header-overview min-w-0 flex-1 basis-[18rem]">
          <p className="mb-1 text-[0.6875rem] tracking-[0.16em] text-[var(--gold-dim)]">{eyebrow}</p>
          <h1 className="text-balance text-[clamp(1.65rem,7vw,2.25rem)] font-bold leading-tight tracking-[-0.03em] text-[var(--gold)]">{title}</h1>
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <Link href={kind === 'deck' ? '/decks' : '/planner/community'} className="board-header-back group min-h-11 items-center gap-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--gold)]" data-board-back>
          <ArrowLeft size={19} className="transition-transform duration-200 group-hover:-translate-x-1 motion-reduce:transform-none" />
          {back}
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <NoteEditorGuide compact />
          <Link href={kind === 'deck' ? '/decks/new' : '/planner'} className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded bg-[var(--gold)] px-3 text-sm font-semibold text-[var(--bg-deep)] transition-colors hover:brightness-110 sm:px-4 sm:text-[1rem]">
            <Plus size={15} />{action}
          </Link>
        </div>
      </div>
    </header>
  )
}
