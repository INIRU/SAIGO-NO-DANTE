import { describe, expect, it } from 'vitest'
import { buildMotionCatalog, defaultMotionState, motionAssetUrl, motionSinnerId, motionStateLabel, type MotionEntry } from '@/lib/motion/catalog'

const entry = (over: Partial<MotionEntry>): MotionEntry => ({
  slug: 'id10216', skillId: 1021601, state: 'v:base', identity: '새벽 사무소 해결사 파우스트', name: '여명의 섬광',
  layers: 1, audio: true, frames: 159, fps: 60, bytes: 100, video: 'faust/10216/1021601/v-base/layers.mp4', meta: 'faust/10216/1021601/v-base/layers.json', ...over,
})

describe('REQ-MOTION-001 the motion list is read from the R2 index', () => {
  it('REQ-MOTION-001 keys a skill by slug and skill id, so a link or LCB entry never takes another identity\'s states', () => {
    const rows = [
      entry({}),
      entry({ state: 'v:best', name: '여명의 섬광 [최고 상태 (관 3단계)]', video: 'faust/10216/1021601/v-best/layers.mp4', meta: 'faust/10216/1021601/v-best/layers.json' }),
      entry({ slug: 'link-heishou-mao-faust', skillId: 1021601, state: 'max', identity: '연계 · 흑수 - 묘 필두 파우스트', name: '연계 [최대 상태]', video: 'links/heishou-mao-faust/1021601/max/layers.mp4', meta: 'links/heishou-mao-faust/1021601/max/layers.json' }),
    ]
    const catalog = buildMotionCatalog(rows, new Map(), 'ko')
    const faust = catalog.find(s => s.id === 'faust')!
    expect(faust.identities.map(i => i.slug)).toEqual(['id10216', 'link-heishou-mao-faust'])
    expect(faust.identities[0].skills[0].states.map(s => s.state)).toEqual(['v:base', 'v:best'])
    expect(faust.identities[1].skills[0].states.map(s => s.state)).toEqual(['max'])
  })

  it('REQ-MOTION-001 maps the R2 sinner folders and the link slugs to the site\'s sinner ids', () => {
    expect(motionSinnerId(entry({ video: 'yisang/10101/1010101/v-base/layers.mp4' }))).toBe('yi-sang')
    expect(motionSinnerId(entry({ video: 'donquixote/10301/x/layers.mp4' }))).toBe('don-quixote')
    expect(motionSinnerId(entry({ video: 'honglu/10601/x/layers.mp4' }))).toBe('hong-lu')
    expect(motionSinnerId(entry({ slug: 'link-heishou-mao-faust', video: 'links/heishou-mao-faust/1021203/base/layers.mp4' }))).toBe('faust')
    expect(motionSinnerId(entry({ slug: 'link-heishou-wu-yisang', video: 'links/heishou-wu-yisang/1/base/layers.mp4' }))).toBe('yi-sang')
    // A link slug without a sinner in it: the skill id's first digits name the sinner.
    expect(motionSinnerId(entry({ slug: 'link-fellbullet', skillId: 1041206, video: 'links/fellbullet/1041206/base/layers.mp4' }))).toBe('ryoshu')
    expect(motionSinnerId(entry({ slug: 'link-id10313', skillId: 1031303, video: 'links/id10313/1031303/base/layers.mp4' }))).toBe('don-quixote')
  })

  it('REQ-MOTION-001 names an identity from the site data when the slug is a game id, and the skill without its state', () => {
    const identities = new Map([['10216', { id: 'uuid-1', name: 'Dawn Office Fixer Faust', sinner_id: 'faust', game_id: '10216', folder_name: 'Dawn Office Fixer', rarity: 3 }]])
    const [faust] = buildMotionCatalog([entry({ name: '여명의 섬광 [기본]' })], identities, 'en')
    expect(faust.identities[0]).toMatchObject({ label: 'Dawn Office Fixer Faust', gameId: '10216', identityId: 'uuid-1' })
    expect(faust.identities[0].portrait).toContain('10216_normal_info')
    expect(faust.identities[0].skills[0].title).toBe('여명의 섬광')
  })
})

describe('REQ-MOTION-002 states', () => {
  const states = [
    entry({ state: 'v:best', name: 'x [최고 상태 (a)]' }), entry({ state: 'v:case2', name: 'x [관 2단계]' }), entry({ state: 'v:base' }),
  ]
  it('REQ-MOTION-002 orders base, then the conditions, then the best or max state, and labels them', () => {
    const [sinner] = buildMotionCatalog(states, new Map(), 'ko')
    const got = sinner.identities[0].skills[0].states
    expect(got.map(s => s.state)).toEqual(['v:base', 'v:case2', 'v:best'])
    expect(got.map(s => s.label)).toEqual(['기본', '관 2단계', '최고 상태 (a)'])
    expect(motionStateLabel(entry({ state: 'max', name: '연계 [최대 상태]' }), 'en')).toBe('Max')
    expect(motionStateLabel(entry({ state: 'base' }), 'ja')).toBe('基本')
  })
  it('REQ-MOTION-002 opens on the best state when there is one, else on base', () => {
    const [sinner] = buildMotionCatalog(states, new Map(), 'ko')
    expect(defaultMotionState(sinner.identities[0].skills[0])).toBe('v:best')
    const [plain] = buildMotionCatalog([entry({}), entry({ state: 'v:case2', name: 'x [관 2단계]' })], new Map(), 'ko')
    expect(defaultMotionState(plain.identities[0].skills[0])).toBe('v:base')
  })
})

it('REQ-MOTION-003 reads every file from the R2 host with its size, so a re-rendered video is fetched again', () => {
  expect(motionAssetUrl('faust/10216/1021601/v-best/layers.mp4', 7357815)).toBe('https://assets.saigo-no-dante.com/faust/10216/1021601/v-best/layers.mp4?v=7357815')
  expect(motionAssetUrl('a/b.json', 0)).toBe('https://assets.saigo-no-dante.com/a/b.json')
})

describe('REQ-MOTION-011 an identity\'s other form', () => {
  it('REQ-MOTION-011 lists a form (id<game id>-<form>) under its identity after the base skills, each skill keeping its own key', () => {
    const identities = new Map([['10215', { id: 'uuid-2', name: '거미집 약지 제자', sinner_id: 'faust', game_id: '10215', folder_name: 'Spider', rarity: 3 }]])
    const at = (slug: string, skillId: number) => entry({ slug, skillId, identity: slug, name: `s${skillId}`, video: `faust/${slug}/${skillId}/v-base/layers.mp4` })
    // The form's rows come first in the index: the identity is still the base one.
    const [faust] = buildMotionCatalog([at('id10215-castoff', 1021505), at('id10215', 1021502), at('id10215', 1021501)], identities, 'ko')
    expect(faust.identities).toHaveLength(1)
    expect(faust.identities[0]).toMatchObject({ slug: 'id10215', label: '거미집 약지 제자', identityId: 'uuid-2' })
    expect(faust.identities[0].skills.map(s => [s.key, s.form])).toEqual([
      ['id10215|1021501', null], ['id10215|1021502', null], ['id10215-castoff|1021505', 'castoff'],
    ])
  })
})

describe('REQ-MOTION-001 identity order', () => {
  it('REQ-MOTION-001 lists identities newest release first, each grouped entry at the release of the identity its skills belong to, a link right after it', () => {
    const info = (game_id: string, release_date: string) => [game_id, { id: `u${game_id}`, name: `n${game_id}`, sinner_id: 'faust', game_id, folder_name: 'f', release_date }] as const
    const identities = new Map([info('10216', '2026-09-10'), info('10212', '2025-06-12'), info('10201', '2023-02-26')])
    const at = (slug: string, skillId: number) => entry({ slug, skillId, identity: slug, video: `faust/${slug}/${skillId}/v-base/layers.mp4` })
    const [faust] = buildMotionCatalog([
      at('lcb-faust', 1020101), at('link-heishou-mao-faust', 1021203), at('id10201', 1020101), at('heishou-mao-faust', 1021201), at('id10216', 1021601),
    ], identities, 'ko')
    expect(faust.identities.map(i => i.slug)).toEqual(['id10216', 'heishou-mao-faust', 'link-heishou-mao-faust', 'id10201', 'lcb-faust'])
  })
})
