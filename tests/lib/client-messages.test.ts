import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import type { AbstractIntlMessages } from 'next-intl'
import { ROOT_OMITTED_MESSAGES, SECTION_MESSAGES, mergeMessages, omitMessages, pickMessages } from '@/lib/i18n/client-messages'

it('leaves section-only messages out of every page and adds each section back without loss', () => {
  for (const messages of [ko, en, ja] as unknown as (AbstractIntlMessages & { planner: AbstractIntlMessages })[]) {
    const root = omitMessages(messages, ROOT_OMITTED_MESSAGES)
    for (const path of ROOT_OMITTED_MESSAGES) {
      // Every listed path exists, so a renamed namespace fails here instead of showing raw keys.
      expect(path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], messages)).toBeDefined()
      expect(path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], root)).toBeUndefined()
    }
    expect((root.planner as Record<string, unknown>).communityBoard).toEqual(messages.planner.communityBoard)
    const all = Object.values(SECTION_MESSAGES).reduce((acc, paths) => mergeMessages(acc, pickMessages(messages, paths)), root)
    expect(all).toEqual(messages)
    expect(JSON.stringify(root).length).toBeLessThan(JSON.stringify(messages).length * 0.7)
  }
  // The original catalog is never mutated.
  expect(ko.planner.run).toBeDefined()
})
