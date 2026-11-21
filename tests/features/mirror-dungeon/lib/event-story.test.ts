import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { eventStory } from '@/features/mirror-dungeon/lib/event-story'

describe('eventStory', () => {
  it('keeps the whole text of a named event', () => {
    expect(eventStory('첫 줄.\n둘째 줄.', '거미의 방')).toBe('첫 줄.\n둘째 줄.')
  })

  it('drops the first line when that line is the title of an unnamed event', () => {
    expect(eventStory('울음소리가 잿빛 황야를 울린다.\n멀리서 안개가 밀려온다.', null)).toBe('멀리서 안개가 밀려온다.')
    expect(eventStory('첫 줄.\n\n둘째 줄.', null)).toBe('둘째 줄.')
  })

  it('keeps the text when the title is only the cut start of a long first line', () => {
    const long = '가'.repeat(41)
    expect(eventStory(`${long}\n둘째 줄.`, null)).toBe(`${long}\n둘째 줄.`)
  })

  it('returns nothing for an unnamed one-line event, whose only line is the title', () => {
    expect(eventStory('한 줄뿐.', null)).toBeNull()
    expect(eventStory(null, null)).toBeNull()
  })
})

// DESIGN.md "하지 않는 것": no monospace labels, no zero-padded numbering, no internal ids on screen.
describe.each(['EventTab', 'EventModal'])('%s', name => {
  const dir = 'features/mirror-dungeon/components'
  it('sets nothing in monospace', () => {
    expect(readFileSync(`${dir}/${name}.module.css`, 'utf8')).not.toContain('--font-mono')
  })
  it('prints no zero-padded number and no #id', () => {
    const source = readFileSync(`${dir}/${name}.tsx`, 'utf8')
    expect(source).not.toContain('padStart')
    expect(source).not.toMatch(/>#\{event\.id\}</)
  })
})
