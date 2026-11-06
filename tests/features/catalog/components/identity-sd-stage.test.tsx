import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { IdentitySpine, SpineForm } from '@/features/catalog/lib/spine-pack'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => [namespace, key].filter(Boolean).join('.') + (values ? JSON.stringify(values) : ''),
}))
// The player needs WebGL; the test only looks at which form is handed to it.
vi.mock('next/dynamic', () => ({ default: () => ({ form }: { form: SpineForm }) => <canvas data-prefab={form.prefab} /> }))

import IdentitySdStage from '@/features/catalog/components/IdentitySdStage'

const form = (prefab: string): SpineForm => ({
  prefab,
  layers: [{ kind: 'spine', dir: prefab, x: 0, y: 0, scaleX: 0.001, scaleY: 0.001, animation: 'idle', loop: true, skin: null, source: 'animation' }],
})
const sd = (...prefabs: string[]): IdentitySpine => ({ base: 'spine/idle/', skeletons: {}, forms: prefabs.map(form) })
const skinned = (start: string | null, skins: string[], skinSets?: { key: string; skins: string[] }[]): IdentitySpine => ({
  base: 'spine/idle/',
  skeletons: { Base: { path: 's/Base/abc/', skeleton: 'skeleton.json', atlas: 'a.atlas', pages: ['a.webp'], premultiplied: true, animations: ['idle'], skins: ['default', ...skins], skinSets, width: 100, height: 200, bytes: 1 } },
  forms: [{ prefab: 'Base', layers: [{ ...form('Base').layers[0], skin: start } as SpineForm['layers'][number]] }],
})
const pressed = (html: string) => [...html.matchAll(/aria-pressed="(true|false)"/g)].map(match => match[1] === 'true')

describe('identity SD stage', () => {
  it('REQ-CATALOG-021 draws no form tabs for an identity with one form', () => {
    const html = renderToStaticMarkup(<IdentitySdStage sd={sd('Base')} name="인격" />)
    expect(html).toContain('data-prefab="Base"')
    expect(html).not.toContain('aria-pressed')
  })

  it('REQ-CATALOG-021 draws one tab per form and starts on the base form', () => {
    const html = renderToStaticMarkup(<IdentitySdStage sd={sd('Base', 'Awaken')} name="인격" />)
    expect(html.match(/aria-pressed=/g)).toHaveLength(2)
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.indexOf('aria-pressed="true"')).toBeLessThan(html.indexOf('aria-pressed="false"'))
    expect(html).toContain('data-prefab="Base"')
    expect(html).not.toContain('data-prefab="Awaken"')
  })

  it('REQ-CATALOG-024 draws a tab per skin of a set, starting on the prefab start skin', () => {
    const html = renderToStaticMarkup(<IdentitySdStage sd={skinned('2', ['1', '2'], [{ key: '', skins: ['1', '2'] }])} name="인격" />)
    expect(pressed(html)).toEqual([false, true])
  })

  it('REQ-CATALOG-024 adds a bare choice to a set the prefab leaves unworn, one row per set', () => {
    const sets = [{ key: 'head', skins: ['head_off', 'head_on'] }, { key: 'weapon', skins: ['weapon1', 'weapon2'] }]
    const html = renderToStaticMarkup(<IdentitySdStage sd={skinned('head_on', ['head_off', 'head_on', 'weapon1', 'weapon2'], sets)} name="인격" />)
    expect(html.match(/role="group"/g)).toHaveLength(2)
    expect(pressed(html)).toEqual([false, true, true, false, false])
  })

  it('REQ-CATALOG-024 draws no row for a set with a single choice', () => {
    expect(renderToStaticMarkup(<IdentitySdStage sd={skinned(null, ['on'])} name="인격" />)).not.toContain('aria-pressed')
  })

  it('REQ-CATALOG-025 draws a tab per animation, starting on the prefab start animation', () => {
    const moving = skinned(null, [])
    moving.skeletons.Base.animations = ['animation', 'animation2']
    moving.forms[0].layers[0] = { ...moving.forms[0].layers[0], animation: 'animation2' } as SpineForm['layers'][number]
    const html = renderToStaticMarkup(<IdentitySdStage sd={moving} name="인격" />)
    expect(pressed(html)).toEqual([false, true])
    expect(html).toContain('>animation2</button>')
  })

  it('REQ-CATALOG-026 labels the tabs with the names in the game data', () => {
    const forms = renderToStaticMarkup(<IdentitySdStage sd={sd('10401_Ryoshu_BaseAppearance', '10401_Ryoshu_Base_CP9Appearance')} name="인격" />)
    expect(forms).toContain('>Base</button>')
    expect(forms).toContain('>Base CP9</button>')
    const skins = renderToStaticMarkup(<IdentitySdStage sd={skinned('nomal', ['blood', 'nomal'], [{ key: '', skins: ['blood', 'nomal'] }])} name="인격" />)
    expect(skins).toContain('>blood</button>')
    expect(skins).toContain('>nomal</button>')
  })

  it('REQ-CATALOG-023 makes the figure a button that opens the large view, which starts closed', () => {
    const html = renderToStaticMarkup(<IdentitySdStage sd={sd('Base')} name="인격" />)
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-label="identity\.sd\.enlarge\{&quot;name&quot;:&quot;인격&quot;\}"/)
    expect(html.match(/data-prefab=/g)).toHaveLength(1)
  })
})
