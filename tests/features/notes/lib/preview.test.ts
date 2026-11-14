import { describe, expect, it } from 'vitest'
import { PREVIEW_DELAY_MS, usesHover } from '@/features/notes/lib/preview'

describe('the preview card opens after 150ms', () => {
  it('opens after 150ms', () => {
    expect(PREVIEW_DELAY_MS).toBe(150)
  })
})

describe('touch never hovers', () => {
  it('only a mouse or a pen opens the card by hovering', () => {
    expect(usesHover('mouse')).toBe(true)
    expect(usesHover('pen')).toBe(true)
    expect(usesHover('touch')).toBe(false)
    expect(usesHover('')).toBe(false)
  })
})
