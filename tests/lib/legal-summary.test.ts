import { expect, it } from 'vitest'
import { LEGAL_CHANGES } from '@/lib/legal-summary'

it('REQ-ACCOUNT-010 the v6 change notes say the frames train the recognizer, with no deletion date for new ones, in every language', () => {
  const words = { ko: ['학습', '180일', '전체 화면'], en: ['train', '180 days', 'entire screen'], ja: ['学習', '180日', '画面全体'] } as const
  for (const lang of ['ko', 'en', 'ja'] as const) {
    const notes = LEGAL_CHANGES.v6?.[lang] ?? []
    expect(notes.length, lang).toBe(3)
    // Training and the end of the deletion date for new frames; the 180 days stay only for what was sent before.
    expect(notes[0], lang).toContain(words[lang][0])
    expect(notes[0], lang).not.toContain(words[lang][1])
    expect(notes[1], lang).toContain(words[lang][1])
    expect(notes[2], lang).toContain(words[lang][2])
  }
})
