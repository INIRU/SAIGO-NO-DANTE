'use client'
import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { ChevronDown, LayoutTemplate } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { showSuccess } from '@/lib/toast'
import { basicTemplate, guideTemplate } from '@/features/notes/lib/templates'
import { useNoteNew } from './NoteNewDot'
import { tr } from '@/features/notes/lib/tr'
import './note-editor.css'


/** "양식 넣기": a small menu of starting templates; the guide template is the new one and carries the gold dot. */
export default function NoteTemplateMenu({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const lang = useLocale()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const news = useNoteNew('template')
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape) }
  }, [open])
  const insert = (content: ReturnType<typeof basicTemplate>, name: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(content).run()
    setOpen(false)
    showSuccess(tr(lang, `${name}을 넣었어요`, `${name}を入れました`, `${name} inserted`))
  }
  const basic = tr(lang, '기본 양식', '基本テンプレート', 'Basic template'), guide = tr(lang, '공략 양식', '攻略テンプレート', 'Guide template')
  return <div className="note-block-menu note-template-menu" ref={wrap}>
    <button type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-label={news.label(tr(lang, '양식 넣기', 'テンプレート', 'Template'))}
      onClick={() => setOpen(!open)} className="note-tool relative flex min-h-9 items-center gap-1.5 px-2 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)] disabled:opacity-40">
      <LayoutTemplate size={15} />{tr(lang, '양식 넣기', 'テンプレート', 'Template')}<ChevronDown size={14} />{news.dot}
    </button>
    {open && <div className="note-command-menu" role="menu" aria-label={tr(lang, '양식 선택', 'テンプレート選択', 'Choose template')}>
      <button type="button" role="menuitem" onMouseDown={event => event.preventDefault()} onClick={() => insert(basicTemplate(lang), basic)}><span>{basic}</span></button>
      <TemplateItem label={guide} onChoose={() => insert(guideTemplate(lang), guide)} />
    </div>}
  </div>
}

/** The guide template's menu row, with its own dot until it has been used once. */
function TemplateItem({ label, onChoose }: { label: string; onChoose: () => void }) {
  const news = useNoteNew('template-guide')
  return <button type="button" role="menuitem" className="relative" aria-label={news.label(label)} onMouseDown={event => event.preventDefault()} onClick={() => { news.used(); onChoose() }}>
    <span>{label}</span>{news.dot && <span className="note-new-dot note-new-dot--row" aria-hidden="true" />}
  </button>
}
