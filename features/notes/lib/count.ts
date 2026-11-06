/** Length shown under the note editor. Only shown: nothing in the editor, API or database stops a longer note. */
export const NOTE_CHAR_LIMIT = 5000

/** Characters the author wrote (line breaks excluded, an emoji counts once). */
export function noteTextLength(text: string): number {
  return [...text.replace(/[\r\n]/g, '')].length
}

export type NoteCountState = 'ok' | 'near' | 'limit'
export function noteCountState(length: number, limit = NOTE_CHAR_LIMIT): NoteCountState {
  return length >= limit ? 'limit' : length >= limit * 0.9 ? 'near' : 'ok'
}

export function formatNoteCount(length: number, locale: string, limit = NOTE_CHAR_LIMIT): string {
  const number = new Intl.NumberFormat(locale)
  return `${number.format(length)} / ${number.format(limit)}`
}
