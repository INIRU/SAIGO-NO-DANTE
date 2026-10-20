import { describe, expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import { shouldOfferAutosave } from '@/lib/drafts/autosave'

const baseline = JSON.stringify({ description: '저장본' })
const draft = (description: string, savedAt: number) => ({ savedAt, state: { description } })

describe('REQ-COMMUNITY-048 restoring an unsaved note draft', () => {
  it('REQ-COMMUNITY-048 offers a draft that differs from the opening state and is newer than the saved one', () => {
    expect(shouldOfferAutosave(draft('편집 중', 2000), baseline, 1000)).toBe(true)
    expect(shouldOfferAutosave(draft('편집 중', 2000), baseline, null)).toBe(true)
  })
  it('REQ-COMMUNITY-048 does not offer a draft older than the saved version, an identical one or none', () => {
    expect(shouldOfferAutosave(draft('편집 중', 1000), baseline, 2000)).toBe(false)
    expect(shouldOfferAutosave(draft('저장본', 3000), baseline, 1000)).toBe(false)
    expect(shouldOfferAutosave(null, baseline, 1000)).toBe(false)
  })
  it('REQ-COMMUNITY-048 names the restore dialog and its toasts in every locale', () => {
    for (const messages of [ko, en, ja]) {
      const copy = messages.common.autosave as Record<string, string>
      for (const key of ['title', 'restore', 'discard', 'restored', 'restoreFailed']) expect(copy[key]).toBeTruthy()
    }
    expect(ko.common.autosave.title).toBe('임시 저장한 글이 있어요')
    expect(ko.common.autosave.restore).toBe('불러오기')
    expect(ko.common.autosave.discard).toBe('버리기')
  })
})
