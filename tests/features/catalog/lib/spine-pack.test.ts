import { describe, expect, it } from 'vitest'
import { dataLabel, formLabel, identitySpine, motionsOf, skinSetsOf, type ImageLayer, type SpineLayer, type SpinePack, type SpineSkeleton } from '@/features/catalog/lib/spine-pack'

const skeleton = (dir: string): SpineSkeleton => ({
  path: `s/${dir}/abc123/`, skeleton: 'skeleton.json', atlas: 'idle.atlas', pages: ['idle.webp'],
  premultiplied: true, animations: ['idle'], skins: ['default'], width: 100, height: 200, bytes: 1,
})
const rig = (dir: string, extra: Partial<SpineLayer> = {}): SpineLayer => ({
  kind: 'spine', dir, x: 0, y: 0, scaleX: 0.001, scaleY: 0.001, animation: 'idle', loop: true, skin: null, source: 'animation', ...extra,
})
const still = (file: string, extra: Partial<ImageLayer> = {}): ImageLayer => ({ kind: 'image', file, object: file, x: 0, y: 0, w: 1536, h: 864, ...extra })
const dirs = (sd: ReturnType<typeof identitySpine>) =>
  sd?.forms.map(form => `${form.prefab}:${form.layers.map(layer => (layer.kind === 'spine' ? layer.dir : layer.file)).join('+')}`)

const idle: SpinePack = {
  pack: 'idle', spine: '4.0.64', base: 'spine/idle/',
  skeletons: Object.fromEntries(['a', 'b', 'b_awaken', 'c_old', 'c_new', 'other'].map(dir => [dir, skeleton(dir)])),
  scenes: {
    A: { id: 1, layers: [rig('a')] },
    B: { id: 2, layers: [rig('b')] },
    B_Awaken: { id: 2, layers: [rig('b_awaken', { off: true })] },
    C: { id: 3, layers: [rig('c_old', { off: true }), rig('c_new')] },
    Other: { id: 9, layers: [rig('other')] },
  },
  identities: { 1: ['A'], 2: ['B', 'B_Awaken'], 3: ['C'], 9: ['Other'] },
}

describe('identity spine pack', () => {
  it('keeps only the forms and skeletons of the requested identity', () => {
    expect(identitySpine(idle, '1')).toEqual({
      base: 'spine/idle/',
      skeletons: { a: idle.skeletons.a },
      forms: [{ prefab: 'A', layers: [idle.scenes.A.layers[0]] }],
    })
  })

  it('gives nothing for an identity the pack does not hold', () => {
    expect(identitySpine(idle, '404')).toBeNull()
    expect(identitySpine(idle, null)).toBeNull()
    expect(identitySpine(null, '1')).toBeNull()
  })

  it('gives one form per prefab, base form first', () => {
    const sd = identitySpine(idle, 2)
    expect(dirs(sd)).toEqual(['B:b', 'B_Awaken:b_awaken'])
    expect(Object.keys(sd!.skeletons).sort()).toEqual(['b', 'b_awaken'])
  })

  it('splits a prefab holding two skeletons into two forms, the one switched on first', () => {
    expect(dirs(identitySpine(idle, 3))).toEqual(['C:c_new', 'C:c_old'])
  })

  it('keeps a full illustration as one form with its frame and without the layers switched off', () => {
    const frame = { x: 0, y: 0, w: 1536, h: 864 }
    const illust: SpinePack = {
      pack: 'illust', spine: '4.0.64', base: 'spine/illust/',
      skeletons: { body: skeleton('body'), spare: skeleton('spare') },
      scenes: { G: { id: 1, frame, safe: frame, layers: [still('i/bg.webp'), rig('body', { source: 'graphic' }), rig('spare', { off: true }), still('i/glow.webp', { off: true })] } },
      identities: { 1: ['G'] },
    }
    const art = identitySpine(illust, 1)
    expect(dirs(art)).toEqual(['G:i/bg.webp+body'])
    expect(art?.forms[0]).toMatchObject({ frame, safe: frame })
    expect(Object.keys(art!.skeletons)).toEqual(['body'])
  })
})

describe('SD skin sets', () => {
  const skinned = (skins: string[], skinSets?: SpineSkeleton['skinSets']): SpineSkeleton => ({ ...skeleton('s'), skins: ['default', ...skins], skinSets })
  const starts = (sets: ReturnType<typeof skinSetsOf>) => sets.map(set => `${set.key}:${set.skins.join('/')}=${set.start}`)

  it('starts a set on the skin the prefab names', () => {
    expect(starts(skinSetsOf(skinned(['1', '2'], [{ key: '', skins: ['1', '2'] }]), '2'))).toEqual([':1/2=2'])
  })

  it('leaves the sets the start skin is not in bare', () => {
    const sets = [{ key: 'head', skins: ['head_off', 'head_on'] }, { key: 'weapon', skins: ['weapon1', 'weapon2'] }]
    expect(starts(skinSetsOf(skinned(['head_off', 'head_on', 'weapon1', 'weapon2'], sets), 'head_on'))).toEqual(['head:head_off/head_on=head_on', 'weapon:weapon1/weapon2=null'])
  })

  it('treats the named skins as one set when the pack gives none, worn from its first skin', () => {
    expect(starts(skinSetsOf(skinned(['on']), null))).toEqual([':on=on'])
    expect(starts(skinSetsOf(skinned(['off', 'on']), 'missing'))).toEqual([':off/on=off'])
  })

  it('gives no set for a skeleton with only its default skin', () => {
    expect(skinSetsOf(skinned([]), 'default')).toEqual([])
  })
})

describe('SD tab names', () => {
  const named = (prefab: string, dir: string) => ({ prefab, layers: [rig(dir)] })

  it('names a form after its prefab, without the id, the sinner and "Appearance"', () => {
    const forms = [named('10401_Ryoshu_BaseAppearance', '10401'), named('10401_Ryoshu_Base_CP9Appearance', '10401_Ryoshu_Base_CP9')]
    expect(forms.map(form => formLabel(form, forms))).toEqual(['Base', 'Base CP9'])
  })

  it('names two forms of one prefab after their skeletons', () => {
    const forms = [named('10202_Faust_WAppearance', '10202_faust'), named('10202_Faust_WAppearance', '10202_02_wcorp_faust')]
    expect(forms.map(form => formLabel(form, forms))).toEqual(['faust', 'wcorp faust'])
  })

  it('shows a skin or animation name as the data spells it, with spaces for underscores', () => {
    expect(['blood', 'nomal', 'head_off', '1_helmet_off'].map(dataLabel)).toEqual(['blood', 'nomal', 'head off', '1 helmet off'])
  })
})

describe('SD animations', () => {
  const moving = (animations: string[]): SpineSkeleton => ({ ...skeleton('s'), animations })

  it('offers the animations of a skeleton that has several', () => {
    expect(motionsOf(moving(['animation', 'animation2']))).toEqual(['animation', 'animation2'])
    expect(motionsOf(moving(['idle']))).toEqual([])
  })

  it('offers nothing when one animation plays all the others together', () => {
    expect(motionsOf(moving(['all', 'idle_body', 'idle_clothes']))).toEqual([])
  })
})
