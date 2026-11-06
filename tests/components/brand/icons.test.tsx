import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import * as icons from '@/components/brand/icons'

const root = resolve(__dirname, '../../..')
const read = (file: string) => readFileSync(resolve(root, file), 'utf8')
const entries = Object.entries(icons).filter(([name]) => name.endsWith('Icon')) as [string, ComponentType<Record<string, unknown>>][]

describe('REQ-SHARED-080 the site icon set', () => {
  it('REQ-SHARED-080 ships the generic glyphs and the section icons', () => {
    const names = entries.map(([name]) => name)
    for (const name of [
      'CloseIcon', 'SearchIcon', 'CheckIcon', 'ArrowLeftIcon', 'ArrowRightIcon', 'ArrowUpIcon', 'ArrowDownIcon', 'ArrowUpRightIcon',
      'ChevronDownIcon', 'ChevronUpIcon', 'ChevronLeftIcon', 'ChevronRightIcon', 'PlusIcon', 'MinusIcon', 'TrashIcon', 'CopyIcon',
      'EditIcon', 'ShareIcon', 'ExternalLinkIcon', 'FilterIcon', 'ResetIcon', 'PlayIcon', 'DownloadIcon', 'EyeIcon', 'EyeOffIcon',
      'HeartIcon', 'CommentIcon', 'UserIcon', 'UsersIcon', 'LayersIcon', 'SettingsIcon', 'LanguageIcon', 'CalendarIcon', 'LoginIcon',
      'DatabaseIcon', 'SinnerRosterIcon', 'IdentityIcon', 'EgoIcon', 'GiftIcon', 'ThemePackIcon', 'EventIcon', 'KeywordIcon',
      'DeckBoardIcon', 'PlanIcon', 'FriendsIcon', 'BoardIcon', 'ToolsIcon', 'MotionIcon', 'FunIcon', 'MirrorDungeonIcon',
    ]) expect(names).toContain(name)
  })

  it('REQ-SHARED-080 every icon is a 24-grid SVG in currentColor, hidden from screen readers', () => {
    expect(entries.length).toBeGreaterThan(50)
    for (const [name, Icon] of entries) {
      const html = renderToStaticMarkup(<Icon />)
      expect(html, name).toMatch(/^<svg[^>]* viewBox="0 0 24 24"/)
      expect(html, name).toContain('aria-hidden="true"')
      expect(html, name).toContain('focusable="false"')
      expect(html, name).toMatch(/(stroke|fill)="currentColor"/)
      // No fixed colours: the icon takes the text colour it sits in.
      const colours = [...html.matchAll(/(?:stroke|fill|color)="([^"]+)"/g)].map(m => m[1])
      expect(colours.filter(c => c !== 'currentColor' && c !== 'none'), name).toEqual([])
    }
  })

  it('REQ-SHARED-080 takes a size and passes SVG props through', () => {
    for (const [name, Icon] of entries) {
      const html = renderToStaticMarkup(<Icon size="1.25rem" className="x" strokeWidth={2.5} data-k="1" />)
      expect(html, name).toContain('width="1.25rem"')
      expect(html, name).toContain('height="1.25rem"')
      expect(html, name).toContain('class="x"')
      expect(html, name).toContain('data-k="1"')
    }
    expect(renderToStaticMarkup(<icons.SearchIcon size={15} />)).toContain('width="15"')
  })
})

// The owner picked only the calendar and language glyphs for the navbar; the rest of it keeps its icons.
describe('REQ-SHARED-081 the navbar calendar and language buttons use the site icons', () => {
  it('REQ-SHARED-081 calendar and language glyphs come from the site set, not lucide', () => {
    for (const file of ['components/layout/Navbar.tsx', 'components/layout/NavbarMobileSheet.tsx']) {
      const source = read(file)
      expect(source, file).toContain("import { CalendarIcon } from '@/components/brand/icons'")
      expect(source, file).not.toMatch(/CalendarDays/)
    }
    const language = read('components/ui/LanguageSwitcher.tsx')
    expect(language).toContain("import { LanguageIcon } from '@/components/brand/icons'")
    expect(language).not.toMatch(/\bLanguages\b/)
  })

  it('REQ-SHARED-081 the home hero buttons carry no lucide icons', () => {
    expect(read('app/[lang]/(home)/HomeClient.tsx')).not.toMatch(/from ['"]lucide-react['"]/)
  })
})

describe('REQ-SHARED-082 shared motion follows reduced motion', () => {
  it('REQ-SHARED-082 the shared press and frame-glow motion stop under reduced motion', () => {
    const css = read('app/globals.css')
    const block = css.slice(css.indexOf('/* motion kit'))
    expect(block).toContain('--ease-out')
    expect(block).toMatch(/prefers-reduced-motion: reduce[^}]*\.press/)
  })
})
