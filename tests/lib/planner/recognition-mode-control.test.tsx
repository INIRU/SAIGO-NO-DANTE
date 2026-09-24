import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RecognitionModeControl, { DEFAULT_RECOGNITION_MODE, RECOGNITION_MODES, isRecognitionMode } from '@/components/planner/run/RecognitionModeControl'

const options = {
  fastest: { label: 'F-label', description: 'F-desc' },
  performance: { label: 'P-label', description: 'P-desc' },
  balanced: { label: 'B-label', description: 'B-desc' },
  quality: { label: 'Q-label', description: 'Q-desc' },
}

it('defaults to balanced and validates stored values', () => {
  expect(DEFAULT_RECOGNITION_MODE).toBe('balanced')
  expect(RECOGNITION_MODES).toEqual(['fastest', 'performance', 'balanced', 'quality'])
  expect(isRecognitionMode('quality')).toBe(true)
  expect(isRecognitionMode('max')).toBe(false)
  expect(isRecognitionMode(null)).toBe(false)
})

it('renders one labelled native radio group with only the given text', () => {
  const html = renderToStaticMarkup(<RecognitionModeControl value="balanced" onChange={() => {}} label="G-label" options={options} note="N-note" />)
  expect(html.match(/<fieldset/g)).toHaveLength(1)
  expect(html).toContain('<legend')
  expect(html).toContain('G-label')
  const radios = html.match(/<input type="radio"[^>]*>/g)!
  expect(radios).toHaveLength(4)
  expect(new Set(radios.map(radio => radio.match(/name="([^"]+)"/)![1])).size).toBe(1)
  expect(radios.filter(radio => radio.includes('checked=""'))).toEqual([expect.stringContaining('value="balanced"')])
  for (const text of ['F-label', 'P-label', 'P-desc', 'B-label', 'Q-desc', 'N-note']) expect(html).toContain(text)
  // Each description is announced with its option; the note with the group.
  const describedBy = radios.map(radio => radio.match(/aria-describedby="([^"]+)"/)![1])
  for (const target of describedBy) expect(html).toContain(`id="${target}"`)
  expect(html).toMatch(/<fieldset[^>]*aria-describedby="[^"]+-note"/)
  expect(html).not.toMatch(/[가-힣]/)
})

it('disables every option through the fieldset', () => {
  const html = renderToStaticMarkup(<RecognitionModeControl value="quality" onChange={() => {}} disabled label="G" options={options} />)
  expect(html).toMatch(/<fieldset[^>]*disabled=""/)
  expect(html).not.toContain('aria-describedby="undefined"')
})
