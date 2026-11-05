import { describe, expect, it } from 'vitest'
import { autosaveKey, parseAutosave, serializeAutosave } from '@/lib/drafts/autosave'

const isNumberState = (value: unknown): value is { n: number } => !!value && typeof (value as { n: unknown }).n === 'number'
describe('autosave', () => {
  it('keys new and edited items apart', () => {
    expect(autosaveKey('deck', null)).not.toBe(autosaveKey('deck', 'abc'))
    expect(autosaveKey('deck', 'abc')).not.toBe(autosaveKey('plan', 'abc'))
    expect(autosaveKey('plan', null)).toBe(autosaveKey('plan', undefined))
  })
  it('round-trips and rejects bad data', () => {
    const raw = serializeAutosave({ n: 1 }, 1000)
    expect(parseAutosave(raw, isNumberState)).toEqual({ savedAt: 1000, state: { n: 1 } })
    expect(parseAutosave(serializeAutosave({ n: 'x' }, 1), isNumberState)).toBeNull()
    expect(parseAutosave('{', isNumberState)).toBeNull()
    expect(parseAutosave(null, isNumberState)).toBeNull()
  })
})
