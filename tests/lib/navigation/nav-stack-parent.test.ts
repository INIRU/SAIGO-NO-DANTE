import { describe, expect, it } from 'vitest'
import { cameFrom } from '@/lib/navigation/nav-stack'

describe('the way back to the list', () => {
  it('knows the previous page by its path, the query and the language aside', () => {
    expect(cameFrom(['/ko', '/ko/motion/skills', '/ko/motion/skills/watch'], '/motion/skills?sinner=2')).toBe(true)
    expect(cameFrom(['/en/motion/skills', '/en/motion/skills/watch'], '/motion/skills')).toBe(true)
  })
  it('says no for another page or a page opened first', () => {
    expect(cameFrom(['/ko/identity/1', '/ko/motion/skills/watch'], '/motion/skills')).toBe(false)
    expect(cameFrom(['/ko/motion/skills/watch'], '/motion/skills')).toBe(false)
  })
})
