import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DetectionToggles from '@/components/planner/run/DetectionToggles'
import { DETECTION_STORAGE_KEY, readDetectionSettings } from '@/lib/vision/detection-settings'

const storage = (value: string | null) => ({ getItem: (key: string) => key === DETECTION_STORAGE_KEY ? value : null })

it('keeps every detection on unless a switch was stored off', () => {
  const all = { gifts: true, themes: true, events: true }
  expect(readDetectionSettings(storage(null))).toEqual(all)
  expect(readDetectionSettings(storage('not json'))).toEqual(all)
  expect(readDetectionSettings(storage('{"gifts":false,"themes":"no"}'))).toEqual({ ...all, gifts: false })
  expect(readDetectionSettings({ getItem: () => { throw new Error('blocked') } })).toEqual(all)
})

it('renders one labelled checkbox per detection kind with its state', () => {
  const options = { gifts: { label: 'G', description: 'g' }, themes: { label: 'T', description: 't' }, events: { label: 'E', description: 'e' } }
  const html = renderToStaticMarkup(<DetectionToggles value={{ gifts: true, themes: false, events: true }} onChange={() => {}} label="L" options={options} />)
  const boxes = html.match(/<input type="checkbox"[^>]*>/g)!
  expect(boxes).toHaveLength(3)
  expect(boxes.filter(box => box.includes('checked=""'))).toHaveLength(2)
  expect(html).toMatch(/data-detection-kind="themes"[\s\S]*?<input type="checkbox"(?![^>]*checked)/)
})
