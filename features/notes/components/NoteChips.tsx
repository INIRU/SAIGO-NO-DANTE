'use client'

// The notes' chip entry: the renderer, the card preview and the entry types. Each chip kind lives in its own file (Note*Chip.tsx).
export { NoteRenderer, NoteCardPreview } from './NoteRenderer'
export { fetchNoteGifts, useNoteGiftLookup } from '@/features/notes/hooks/useNoteGiftLookup'
export type { NoteSkillEntry, NotePassiveEntry, NoteEgoEntry, NoteIdentityEntry, NoteEgoGiftEntry } from '@/features/notes/lib/note-entries'
