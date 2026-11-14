import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markNoteFeatureUsed, newFeatureKey, newFeatureLabel, noteFeatureIsNew, subscribeNoteFeatures } from '@/features/notes/lib/new-feature'

function stubStorage(store: Record<string, string> = {}) {
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
  return store
}
beforeEach(() => { stubStorage() })
afterEach(() => { vi.unstubAllGlobals() })

describe('new tool dots', () => {
  it('uses one versioned key per feature', () => {
    expect(newFeatureKey('strike')).toBe('note-editor-new:v1:strike')
  })
  it('a feature is new until it is used, and stays used', () => {
    expect(noteFeatureIsNew('highlight')).toBe(true)
    markNoteFeatureUsed('highlight')
    expect(noteFeatureIsNew('highlight')).toBe(false)
    expect(noteFeatureIsNew('mention')).toBe(true)
  })
  it('tells subscribers when a feature was used, so every button of it clears at once', () => {
    const seen = vi.fn()
    const stop = subscribeNoteFeatures(seen)
    markNoteFeatureUsed('duplicate')
    expect(seen).toHaveBeenCalledTimes(1)
    stop()
    markNoteFeatureUsed('color')
    expect(seen).toHaveBeenCalledTimes(1)
  })
  it('survives storage that throws: nothing breaks and the dot goes for this visit', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(() => markNoteFeatureUsed('strike')).not.toThrow()
    expect(noteFeatureIsNew('strike')).toBe(false)
    expect(noteFeatureIsNew('never-used-in-this-visit')).toBe(true)
  })
  it('adds the word for "new feature" to the accessible name only while it shows', () => {
    expect(newFeatureLabel('취소선', true, 'ko')).toBe('취소선, 새 기능')
    expect(newFeatureLabel('Strikethrough', true, 'en')).toBe('Strikethrough, New')
    expect(newFeatureLabel('取り消し線', true, 'ja')).toBe('取り消し線, 新機能')
    expect(newFeatureLabel('취소선', false, 'ko')).toBe('취소선')
  })
  it('the dot is a small gold circle with no text', () => {
    const css = readFileSync('features/notes/components/note-new-dot.css', 'utf8')
    const rule = css.match(/\.note-new-dot\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('width:.375rem')
    expect(rule).toContain('background:var(--gold-light)')
    expect(rule).toContain('border-radius:50%')
  })
})
