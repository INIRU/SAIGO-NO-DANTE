import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const read = (file: string) => readFileSync(resolve(__dirname, '../../../..', file), 'utf8')

it('REQ-MOTION-057 the skill motion picker fills the width with 7.5rem cards, as the sinner page does', () => {
  for (const file of ['features/motion/components/MotionBrowser.tsx', 'features/motion/components/SkillMotionSkeleton.tsx']) {
    expect(read(file), file).toContain('grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]')
    expect(read(file), file).not.toContain('minmax(9.5rem')
  }
})
