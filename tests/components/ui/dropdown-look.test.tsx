import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Dropdown from '@/components/ui/Dropdown'

const css = readFileSync(resolve(__dirname, '../../../components/ui/Dropdown.module.css'), 'utf8')
const options = [{ value: 'all', label: '전체' }, { value: 'owned', label: '보유' }]

describe('the shared dropdown', () => {
  it('the button marks a value other than the default and reads in the body font', () => {
    const changed = renderToStaticMarkup(<Dropdown value="owned" defaultValue="all" options={options} onChange={() => {}} />)
    expect(changed).toContain('data-active="true"')
    expect(renderToStaticMarkup(<Dropdown value="all" defaultValue="all" options={options} onChange={() => {}} />)).not.toContain('data-active')
    expect(css).toMatch(/\.trigger \{[^}]*font-family: var\(--font-body\)/)
  })

  it('the menu grows from the button, the chosen row carries a check, hover is for fine pointers', () => {
    expect(css).toMatch(/\.menu \{[^}]*transform-origin: top left/)
    expect(css).toMatch(/@keyframes dropdown-in/)
    expect(css).toMatch(/\.item\[aria-checked='true'\] \.check \{ opacity: 1; \}/)
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{[^@]*\.trigger:hover/)
    expect(css.slice(css.indexOf('prefers-reduced-motion: reduce'))).toMatch(/animation: none/)
  })
})
