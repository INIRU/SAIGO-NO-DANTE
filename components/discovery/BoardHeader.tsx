import { ArrowLeft, Plus } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'

export default function BoardHeader({ kind, lang, title, subtitle, eyebrow, action }: {
  kind: 'deck' | 'planner'; lang: string; title: string; subtitle: string; eyebrow: string; action: string
}) {
  const back = lang === 'ko' ? `${title}으로` : lang === 'ja' ? `${title}に戻る` : `Back to ${title}`
  return (
    <header className="board-header mx-auto w-full max-w-7xl shrink-0 px-4 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="board-header-overview min-w-0">
          <p className="mb-2 font-[family-name:var(--font-mono)] text-[0.625rem] tracking-[0.3em] text-[var(--gold-dim)]">{eyebrow}</p>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl text-[var(--gold)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <Link href={kind === 'deck' ? '/decks' : '/planner/community'} className="board-header-back group min-h-11 items-center gap-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--gold)]" data-board-back>
          <ArrowLeft size={19} className="transition-transform duration-200 group-hover:-translate-x-1 motion-reduce:transform-none" />
          {back}
        </Link>
        <Link href={kind === 'deck' ? '/decks/new' : '/planner'} className="flex min-h-11 shrink-0 items-center gap-2 rounded px-4 text-sm font-semibold text-[var(--bg-deep)] bg-[var(--gold)] transition-colors hover:brightness-110">
          <Plus size={15} />{action}
        </Link>
      </div>
    </header>
  )
}
