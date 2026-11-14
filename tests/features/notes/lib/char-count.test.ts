import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NOTE_CHAR_LIMIT, formatNoteCount, noteCountState, noteTextLength } from '@/features/notes/lib/count'

describe('note character count', () => {
  it('counts characters without line breaks, an emoji or a syllable as one', () => {
    expect(noteTextLength('가나다')).toBe(3)
    expect(noteTextLength('가\n나\r\n다')).toBe(3)
    expect(noteTextLength('a b')).toBe(3)
    expect(noteTextLength('😀')).toBe(1)
    expect(noteTextLength('')).toBe(0)
  })
  it('turns gold from 90% of the limit and red at the limit', () => {
    expect(NOTE_CHAR_LIMIT).toBe(5000)
    expect(noteCountState(0)).toBe('ok')
    expect(noteCountState(4499)).toBe('ok')
    expect(noteCountState(4500)).toBe('near')
    expect(noteCountState(4999)).toBe('near')
    expect(noteCountState(5000)).toBe('limit')
    expect(noteCountState(6200)).toBe('limit')
  })
  it('writes "count / limit" with the reader\'s thousands separator', () => {
    expect(formatNoteCount(1234, 'ko')).toBe('1,234 / 5,000')
    expect(formatNoteCount(1234, 'en')).toBe('1,234 / 5,000')
    expect(formatNoteCount(1234, 'ja')).toBe('1,234 / 5,000')
    expect(formatNoteCount(0, 'ko')).toBe('0 / 5,000')
  })
  it('is drawn muted in the digit font, gold near the limit and in the error colour at it', () => {
    const css = readFileSync('features/notes/components/note-editor.css', 'utf8')
    const rule = (selector: string) => css.match(new RegExp(selector.replace(/[[\]]/g, '\\$&') + '\\{[^}]*\\}'))?.[0] ?? ''
    expect(rule('.note-count')).toContain('font-family:var(--font-title)')
    expect(rule('.note-count')).toContain('color:var(--text-muted)')
    expect(rule('.note-count[data-state=near]')).toContain('var(--gold-light)')
    expect(rule('.note-count[data-state=limit]')).toContain('var(--error)')
  })
})
