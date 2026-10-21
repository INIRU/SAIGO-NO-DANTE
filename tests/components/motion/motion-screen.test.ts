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

  it('REQ-MOTION-013 sets the flag and its own way back for the page and its loading screen alike', () => {
    const layout = read('app/[lang]/motion/skills/layout.tsx')
    expect(layout).toContain('<MotionScreenFlag />')
    expect(layout).toMatch(/<BackLink href="\/"/)
    expect(read('components/motion/MotionScreenFlag.tsx')).toContain("useHtmlFlag('with-motion')")
  })
})
