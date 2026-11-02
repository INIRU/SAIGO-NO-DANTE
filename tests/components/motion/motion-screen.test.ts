import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(__dirname, '../../..', path), 'utf8')

describe('REQ-MOTION-013 the motion page is a full-screen viewer', () => {
  it('REQ-MOTION-013 hides the navigation and footer, frees the space under the navigation, and stops the page scroll on desktop', () => {
    const workspaces = read('styles/globals/workspaces.css')
    expect(workspaces).toMatch(/html\[data-with-motion\] :is\(\.site-navigation, \.site-footer\) \{ display: none; \}/)
    expect(workspaces).toMatch(/@media \(min-width: 64rem\) \{ html\[data-with-motion\], html\[data-with-motion\] body \{ overflow: hidden; \} \}/)
    expect(read('app/globals.css')).toMatch(/html:is\([^)]*\[data-with-motion\][^)]*\)\{--nav-offset:0rem\}/)
  })

  it('REQ-MOTION-044 sets the flag on the watching page and its loading screen, not on the picking page', () => {
    expect(read('app/[lang]/motion/skills/watch/layout.tsx')).toContain('<MotionScreenFlag />')
    expect(read('app/[lang]/motion/skills/layout.tsx')).not.toContain('MotionScreenFlag')
    expect(read('components/motion/MotionWatch.tsx')).toMatch(/<BackLink href=/)
    expect(read('components/motion/MotionScreenFlag.tsx')).toContain("useHtmlFlag('with-motion')")
  })

  it('REQ-MOTION-045 sends the old single-page address to the watching page, the query going along', () => {
    const config = read('next.config.ts')
    expect(config).toContain("source: '/motion/skills', has: skill, destination: '/motion/skills/watch', permanent: true")
    expect(config).toContain("source: '/:lang(ko|en|ja)/motion/skills', has: skill, destination: '/:lang/motion/skills/watch', permanent: true")
  })
})
