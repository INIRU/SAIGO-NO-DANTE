'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useEditorState, type Editor } from '@tiptap/react'
import { Highlighter, Palette, Strikethrough, X } from 'lucide-react'
import QuietImage from '@/components/ui/QuietImage'
import { getSinIconUrl } from '@/lib/constants/sin'
import { NOTE_COLOR_SINS, isNoteColorSin } from '@/lib/notes/text-style'

const toolClass = 'flex h-9 w-9 items-center justify-center text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)] disabled:opacity-40'

/** Strikethrough, highlight and the sin-colour picker of the note toolbar. */
export default function NoteMarkTools({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const locale = useLocale(), label = (ko: string, ja: string, en: string) => locale === 'ja' ? ja : locale === 'en' ? en : ko
  const tSin = useTranslations('sin')
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const sin = current?.getAttributes('noteColor').sin
      return { strike: Boolean(current?.isActive('strike')), highlight: Boolean(current?.isActive('highlight')), sin: isNoteColorSin(sin) ? sin : null }
    },
  })
  const [open, setOpen] = useState(false), [shift, setShift] = useState(0)
  const wrap = useRef<HTMLDivElement>(null), popover = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  // Keep the picker inside the screen when the button sits near the right edge (phones).
  useLayoutEffect(() => {
    if (!open || !wrap.current || !popover.current) return
    const room = document.documentElement.clientWidth - 8 - wrap.current.getBoundingClientRect().left - popover.current.offsetWidth
    setShift(Math.min(0, room))
  }, [open])
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape) }
  }, [open])
  const keepSelection = (event: React.MouseEvent) => event.preventDefault()
  const off = disabled || !editor
  const chooseColor = (sin: string | null) => {
    if (!editor) return
    const chain = editor.chain().focus()
    if (sin) chain.setMark('noteColor', { sin }).run(); else chain.unsetMark('noteColor').run()
    setOpen(false)
  }
  const colorLabel = label('글자 색', '文字色', 'Text color')
  return <>
    <button type="button" aria-label={label('취소선', '取り消し線', 'Strikethrough')} aria-pressed={state?.strike} data-active={state?.strike || undefined} disabled={off} onMouseDown={keepSelection} onClick={() => editor?.chain().focus().toggleStrike().run()} className={toolClass}><Strikethrough size={16} /></button>
    <button type="button" aria-label={label('형광펜', '蛍光ペン', 'Highlight')} aria-pressed={state?.highlight} data-active={state?.highlight || undefined} disabled={off} onMouseDown={keepSelection} onClick={() => editor?.chain().focus().toggleMark('highlight').run()} className={toolClass}><Highlighter size={16} /></button>
    <div className="note-mark-tool" ref={wrap}>
      <button type="button" ref={trigger} aria-label={colorLabel} aria-haspopup="true" aria-expanded={open} data-active={state?.sin ? true : undefined} disabled={off} onMouseDown={keepSelection} onClick={() => setOpen(!open)} className={toolClass}>
        {state?.sin ? <QuietImage src={getSinIconUrl(state.sin)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem' }} /> : <Palette size={16} />}
      </button>
      {open && <div className="note-color-popover" role="group" aria-label={colorLabel} ref={popover} style={{ left: shift }}>
        <div className="note-color-swatches">
          {NOTE_COLOR_SINS.map(sin => <button key={sin} type="button" className="note-color-swatch" aria-label={tSin(sin)} title={tSin(sin)} aria-pressed={state?.sin === sin} onMouseDown={keepSelection} onClick={() => chooseColor(sin)}>
            <QuietImage src={getSinIconUrl(sin)} alt="" width={24} height={24} />
          </button>)}
        </div>
        <button type="button" className="note-color-clear" onMouseDown={keepSelection} onClick={() => chooseColor(null)}><X size={14} />{label('색 지우기', '色を消す', 'Remove color')}</button>
      </div>}
    </div>
  </>
}
