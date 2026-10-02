import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const dir = resolve(__dirname, '../../../public/models/assist-scene')
const text = (file: string) => readFileSync(resolve(dir, file), 'utf8')
const sha = (file: string) => createHash('sha256').update(readFileSync(resolve(dir, file))).digest('hex')

it('REQ-ASSIST-064 the shipped scene and icon models are the ones their provenance describes', () => {
  // A model file swapped without its record (or a record updated without the file) fails here.
  const provenance = text('PROVENANCE.md')
  for (const file of ['scene.onnx', 'icon-classifier.onnx']) expect(provenance, file).toContain('sha256 `' + sha(file).slice(0, 16))
  expect(JSON.parse(text('metadata.json')).version).toBe('2026-10-02')
  // The scene labels and their order are what the app's rules name; a retrained model keeps them.
  expect(JSON.parse(text('labels.json'))).toEqual(['battle', 'battle_setup', 'enhance', 'event', 'exploration', 'fusion', 'gift_acquired', 'loading',
    'reward_choice', 'run_end', 'run_setup', 'sell', 'shop', 'start_gift', 'theme_select'])
})

it('REQ-ASSIST-065 the icon model knows the gifts added to the catalog since it was first trained', () => {
  const labels: string[] = JSON.parse(text('icon-labels.json'))
  for (const gift of ['9836', '9837', '9838', '9839']) expect(labels).toContain(gift)
  // Vestiges stay one class and an empty slot one.
  expect(labels.filter(label => /^999[2-5]$/.test(label))).toEqual([])
  expect(labels).toContain('9991')
  expect(labels.at(-1)).toBe('blank')
  expect(new Set(labels).size).toBe(labels.length)
})
