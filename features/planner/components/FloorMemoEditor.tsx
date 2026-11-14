'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { NoteRenderer } from '@/features/notes/components/NoteChips'
import type { NoteEgoGiftEntry } from '@/features/notes/components/NoteChips'
import type { AutocompleteSuggestion } from '@/features/notes/components/NoteAutocomplete'
import type { NoteFormationMember } from '@/features/notes'

// Tiptap and ProseMirror load when a floor memo is shown, not with the planner page. The shell holds its toolbar and 7rem body.
const NoteDocumentEditor = dynamic(() => import('@/features/notes/components/NoteDocumentEditor'), {
  ssr: false,
  loading: () => <div className="note-editor-shell min-h-[10rem] rounded-md bg-[var(--bg-deep)]" aria-busy="true" />,
})

/** A floor's memo: the same block editor as the plan description and deck notes, with its own preview toggle. */
export default function FloorMemoEditor({
  value,
  onChange,
  pool,
  formation,
  allowedKeywords,
  egoGiftLookup,
}: {
  value: string
  onChange: (v: string) => void
  pool: AutocompleteSuggestion[]
  formation: NoteFormationMember[]
  allowedKeywords?: Set<string>
  egoGiftLookup?: Record<string, NoteEgoGiftEntry>
}) {
  const [preview, setPreview] = useState(false)
  return (
    // 층 메모는 짧다: 편집기 기본 높이(24rem)를 줄인다
    <div className="[&_.note-document-content]:!min-h-[7rem] [&_.note-document-content]:!px-5 [&_.note-document-content]:!py-4 [&_.note-editor-preview]:!min-h-[7rem] [&_.note-editor-preview]:!p-4">
    <NoteDocumentEditor
      formation={formation}
      pool={pool}
      value={value}
      onChange={onChange}
      preview={preview}
      onPreviewChange={setPreview}
      previewContent={<NoteRenderer text={value} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />}
    />
    </div>
  )
}
