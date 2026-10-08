import { describe, expect, it } from 'vitest'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import ko from '@/messages/ko.json'

type Messages = { [key: string]: unknown }

const keysOf = (messages: Messages, prefix = ''): string[] =>
  Object.entries(messages).flatMap(([key, value]) => (value && typeof value === 'object' ? keysOf(value as Messages, `${prefix}${key}.`) : [`${prefix}${key}`]))

/** Keys of `from` that `other` does not have. */
const missingKeys = (from: Messages, other: Messages) => {
  const present = new Set(keysOf(other))
  return keysOf(from).filter(key => !present.has(key))
}

describe('REQ-SHARED-033 ko/en/ja message keys match', () => {
  it('REQ-SHARED-033 names a key that one language lacks', () => {
    expect(missingKeys({ friends: { title: 'a', guide: { step: 'b' } } }, { friends: { title: 'a', guide: {} } })).toEqual(['friends.guide.step'])
  })

  const languages: Record<string, Messages> = { ko, en, ja }
  it.each([
    ['ko', 'en'], ['ko', 'ja'], ['en', 'ko'], ['en', 'ja'], ['ja', 'ko'], ['ja', 'en'],
  ])('REQ-SHARED-033 every %s key exists in %s', (from, other) => {
    expect(missingKeys(languages[from], languages[other])).toEqual([])
  })
})
