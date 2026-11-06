// Public entry of the notes feature: types and pure functions/constants only.
// Components and hooks are imported by file path (@/features/notes/components/<Name>, @/features/notes/hooks/<name>).
export { assetName, giftPreviewAsset, type NoteAssetData, type NoteFormationMember } from './lib/assets'
export { findNoteGift } from './lib/note-gift'
export { NOTE_TOC_MIN, markdownHeadings } from './lib/toc'
export { autosaveKey } from './lib/autosave'
export { DECK_DRAFTS_KEY, isDeckDraft, loadDeckDraftSlots, type DeckDraft } from './lib/deck-drafts'
