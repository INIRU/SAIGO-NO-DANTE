import { describe, expect, it } from 'vitest'
import { buildMotionCatalog, defaultMotionState, motionCatalogFrom, MOTION_INDEX_URL, formatMotionLabelKey, motionAssetUrl, motionSinnerId, motionStateLabel, motionVideoFiles, VP9_444_TYPE, type MotionEntry } from '@/lib/motion/catalog'

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
    expect(motionStateLabel(entry({ state: 'max', name: '연계 [최대 상태]' }), 'en')).toBe('Max State')
    expect(motionStateLabel(entry({ state: 'base' }), 'ja')).toBe('基本')
  })
  it('REQ-MOTION-002 opens on the best state when there is one, else on base', () => {
    const [sinner] = buildMotionCatalog(states, new Map(), 'ko')
    expect(defaultMotionState(sinner.identities[0].skills[0])).toBe('v:best')
    const [plain] = buildMotionCatalog([entry({}), entry({ state: 'v:case2', name: 'x [관 2단계]' })], new Map(), 'ko')
    expect(defaultMotionState(plain.identities[0].skills[0])).toBe('v:base')
  })
})

it('REQ-MOTION-003 reads every file from the R2 host at its plain path, the address the upload purges from the edge cache', () => {
  expect(motionAssetUrl('faust/10216/1021601/v-best/layers.mp4')).toBe('https://assets.saigo-no-dante.com/faust/10216/1021601/v-best/layers.mp4')
  expect(motionAssetUrl('a/b.json')).toBe('https://assets.saigo-no-dante.com/a/b.json')
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

describe('REQ-MOTION-002 state buttons read the index label', () => {
  it('REQ-MOTION-002 writes the index label as it is, even when the name has brackets inside its condition', () => {
    const best3 = entry({ state: 'v:best-3', name: '삼연[三連] [최고 상태 (얽힘 5 이상 + 나생[羅生])]', label: '최고 상태' })
    expect(motionStateLabel(best3, 'ko')).toBe('최고 상태')
    expect(motionStateLabel(entry({ state: 'v:reflex', name: 'x [레플렉시옹 보유]', label: '레플렉시옹 보유' }), 'ko')).toBe('레플렉시옹 보유')
    expect(motionStateLabel(entry({ state: 'v:base', name: 'x', label: '기본' }), 'ko')).toBe('기본')
  })

  it('REQ-MOTION-002 turns only the three fixed labels into the page language', () => {
    expect(motionStateLabel(entry({ state: 'v:best-2', name: 'x [최고 상태 (a)]', label: '최고 상태' }), 'en')).toBe('Best State')
    expect(motionStateLabel(entry({ state: 'max', name: 'x [최대 상태]', label: '최대 상태' }), 'ja')).toBe('最大状態')
    expect(motionStateLabel(entry({ state: 'v:base', name: 'x', label: '기본' }), 'ja')).toBe('基本')
    expect(motionStateLabel(entry({ state: 'v:reflex', name: 'x [레플렉시옹 보유]', label: '레플렉시옹 보유' }), 'en')).toBe('레플렉시옹 보유')
  })
})

describe('REQ-MOTION-014 identities and skills by id, links as states, labels from labelKey', () => {
  const info = (game_id: string, name: string, sinner_id: string, sinner_name: string) => [game_id, { id: `u${game_id}`, name, sinner_id, sinner_name, game_id, folder_name: 'f', release_date: '2025-08-28' }] as const
  const en = new Map([info('10613', 'The Lord of Hongyuan', 'hong-lu', 'Hong Lu'), info('10114', 'Heishou Pack - Wu Branch Adept', 'yi-sang', 'Yi Sang'), info('10104', 'Blade Lineage Salsu', 'yi-sang', 'Yi Sang')])
  const ko = new Map([info('10613', '홍원 군주', 'hong-lu', '홍루'), info('10114', '흑수 - 오 필두', 'yi-sang', '이상'), info('10104', '검계 살수', 'yi-sang', '이상')])
  const refs = { Charge: { k: 'keyword' as const, n: 'Charge', kw: '충전' }, SojiRyoshuEntangle: { k: 'keyword' as const, n: 'String Severance [絕緣]', kw: '절연' } }
  const refsKo = { Charge: { k: 'keyword' as const, n: '충전', kw: '충전' }, SojiRyoshuEntangle: { k: 'keyword' as const, n: '절연[絕緣]', kw: '절연' } }
  const row = (over: Partial<MotionEntry>) => entry({ slug: 'id10613', identityId: '10613', skillId: 1061305, identity: '홍원 군주 홍루', name: '군주의 길을 열겠다', video: 'honglu/10613/1061305/x.mp4', ...over })
  const rows = [
    row({ state: 'v:base', label: '기본', labelEn: 'Base' }),
    row({ state: 'v:link-10114', label: '흑수 이상 연계', labelEn: 'Heishou Yi Sang Link', labelKey: '<i:10114>', members: ['10613', '10114'], linkMax: false }),
    row({ state: 'v:link-10114-max', label: '흑수 이상 연계 (최대 상태)', labelKey: '<i:10114>', members: ['10613', '10114'], linkMax: true }),
    row({ state: 'v:charge15', label: '충전 15 이상', labelEn: 'Charge 15 or more', labelKey: '[Charge] 15 + [SojiRyoshuEntangle] 2' }),
    row({ state: 'v:best', label: '최고 상태', labelEn: 'Best State' }),
  ]
  const names = new Map([[1061305, 'Clear the Way for the Lord']]), namesKo = new Map([[1061305, '군주의 길을 열겠다!']])

  it('REQ-MOTION-014 names identities and skills from the site data by id, and keeps a link as a state of its skill', () => {
    const honglu = buildMotionCatalog(rows, en, 'en', { skillNames: names, refs }).find(s => s.id === 'hong-lu')!
    expect(honglu.identities).toHaveLength(1)
    expect(honglu.identities[0].label).toBe('The Lord of Hongyuan')
    expect(honglu.identities[0].skills[0].title).toBe('Clear the Way for the Lord')
    // The Korean page reads the site data too; the index name is only a fallback.
    const hongluKo = buildMotionCatalog(rows, ko, 'ko', { skillNames: namesKo, refs: refsKo }).find(s => s.id === 'hong-lu')!
    expect(hongluKo.identities[0].label).toBe('홍원 군주')
    expect(hongluKo.identities[0].skills[0].title).toBe('군주의 길을 열겠다!')
  })

  it('REQ-MOTION-014 writes a state from its labelKey: keywords and stacks from the site keyword table, an identity for a link, then the max mark', () => {
    const labels = (lang: string, ids: typeof en, r: typeof refs) => buildMotionCatalog(rows, ids, lang, { refs: r }).find(s => s.id === 'hong-lu')!.identities[0].skills[0].states.map(x => x.label)
    expect(labels('en', en, refs)).toEqual(['Base', 'Charge 15 + String Severance [絕緣] 2', 'Link: Heishou Pack - Wu Branch Adept Yi Sang', 'Link: Heishou Pack - Wu Branch Adept Yi Sang (Max State)', 'Best State'])
    expect(labels('ko', ko, refsKo)).toEqual(['기본', '충전 15 + 절연[絕緣] 2', '연계: 흑수 - 오 필두 이상', '연계: 흑수 - 오 필두 이상 (최대 상태)', '최고 상태'])
  })

  it('REQ-MOTION-014 falls back to the label of the page language when a labelKey cannot be resolved', () => {
    const labels = buildMotionCatalog(rows, en, 'en', { refs: {} }).find(s => s.id === 'hong-lu')!.identities[0].skills[0].states.map(x => x.label)
    expect(labels).toContain('Charge 15 or more')
  })
})

describe('REQ-MOTION-015 skill names from the site data', () => {
  it('REQ-MOTION-015 names a skill by its id from the site data, then the index field, then the index name', () => {
    const rows = [
      entry({ slug: 'id10116', skillId: 1011601, name: '차원 베기', video: 'yisang/10116/1011601/v-base/layers.mp4' }),
      entry({ slug: 'id10116', skillId: 1011602, name: '연속 차원 베기', nameEn: 'Index name', video: 'yisang/10116/1011602/v-base/layers.mp4' }),
      entry({ slug: 'id10116', skillId: 1011606, name: 'EX 스킬', video: 'yisang/10116/1011606/v-base/layers.mp4' }),
    ]
    const titles = (lang: string, skillNames: Map<number, string>) => buildMotionCatalog(rows, new Map(), lang, { skillNames })[0].identities[0].skills.map(s => s.title)
    expect(titles('en', new Map([[1011601, 'Dimensional Slice']]))).toEqual(['Dimensional Slice', 'Index name', 'EX 스킬'])
    expect(titles('ko', new Map([[1011601, '차원 베기!']]))).toEqual(['차원 베기!', '연속 차원 베기', 'EX 스킬'])
  })
})

describe('REQ-MOTION-016 effect names from labelKey', () => {
  it('REQ-MOTION-016 writes a layer labelKey with the site keyword table, and gives nothing back for a key it cannot resolve', () => {
    const refs = { Charge: { k: 'keyword' as const, n: '충전', kw: '충전' }, Sinking: { k: 'keyword' as const, n: '침잠', kw: '침잠' } }
    expect(formatMotionLabelKey('[Charge] 15', refs, () => undefined)).toBe('충전 15')
    expect(formatMotionLabelKey('[Sinking] + [Charge] 3', refs, () => undefined)).toBe('침잠 + 충전 3')
    expect(formatMotionLabelKey('[Unknown] 2', refs, () => undefined)).toBeNull()
    expect(formatMotionLabelKey('[Charge] 10~19', refs, () => undefined)).toBe('충전 10~19')
    // A key that holds word tokens (<stage:2>, <up>, <coin:1>…) is left to the index's label sentence.
    expect(formatMotionLabelKey('[Charge] <stage:2>', refs, () => undefined)).toBeNull()
    expect(formatMotionLabelKey('[Sinking] <count> 10 <up>', refs, () => undefined)).toBeNull()
    expect(formatMotionLabelKey('<i:10114>', refs, id => (id === '10114' ? '흑수 - 오 필두' : undefined))).toBe('흑수 - 오 필두')
  })
})

describe('REQ-MOTION-018 a link state names its partner', () => {
  it('REQ-MOTION-018 gives a link state the identity it links with (name, sinner, portrait) and whether it is the max video', () => {
    const info = (game_id: string, name: string, sinner_id: string, sinner_name: string) => [game_id, { id: `u${game_id}`, name, sinner_id, sinner_name, game_id, folder_name: 'Heishou', release_date: '2025-08-28' }] as const
    const ids = new Map([info('10613', '홍원 군주', 'hong-lu', '홍루'), info('10114', '흑수 - 오 필두', 'yi-sang', '이상')])
    const row = (state: string, linkMax: boolean) => entry({ slug: 'id10613', identityId: '10613', skillId: 1061305, state, labelKey: '<i:10114>', members: ['10613', '10114'], linkMax, video: 'honglu/10613/1061305/x.mp4' })
    const states = buildMotionCatalog([row('v:link-10114', false), row('v:link-10114-max', true), entry({ slug: 'id10613', identityId: '10613', skillId: 1061305, state: 'v:base', label: '기본', video: 'honglu/10613/1061305/b.mp4' })], ids, 'ko')
      .find(s => s.id === 'hong-lu')!.identities[0].skills[0].states
    expect(states[0].link).toBeUndefined()
    expect(states[1].link).toMatchObject({ gameId: '10114', name: '흑수 - 오 필두', sinner: '이상', max: false })
    expect(states[1].link!.portrait).toContain('10114')
    expect(states[2].link).toMatchObject({ gameId: '10114', max: true })
  })
})


describe('REQ-MOTION-019 a skill carries its frame', () => {
  it('REQ-MOTION-019 gives a skill the sin, slot and attack type of its site row, and none when the site has no row', () => {
    const rows = [
      entry({ slug: 'id10613', identityId: '10613', skillId: 1061301, video: 'honglu/10613/1061301/v-base/layers.mp4' }),
      entry({ slug: 'id10613', identityId: '10613', skillId: 1061399, video: 'honglu/10613/1061399/v-base/layers.mp4' }),
    ]
    const skillFrames = new Map([[1061301, { sin: 'gloom', slot: 1, attack: 'slash' as const }]])
    const skills = buildMotionCatalog(rows, new Map(), 'ko', { skillFrames })[0].identities[0].skills
    expect(skills[0].frame).toEqual({ sin: 'gloom', slot: 1, attack: 'slash' })
    expect(skills[1].frame).toBeNull()
  })

  it('REQ-MOTION-023 lists the skills in the game order (skill 1, 2, 3, then defense), not by skill id', () => {
    // 남부 세븐 협회 6과 이상: 1010202 is skill 3 and 1010203 is skill 2.
    const rows = [1010204, 1010203, 1010202, 1010201].map(skillId => entry({ slug: 'id10102', identityId: '10102', skillId, video: `yisang/10102/${skillId}/v-base/layers.mp4` }))
    const skillFrames = new Map([
      [1010201, { sin: 'gloom', slot: 1, attack: 'pierce' as const }],
      [1010202, { sin: 'sloth', slot: 3, attack: 'blunt' as const }],
      [1010203, { sin: 'gluttony', slot: 2, attack: 'pierce' as const }],
      [1010204, { sin: 'gluttony', slot: 4, attack: null }],
    ])
    const skills = buildMotionCatalog(rows, new Map(), 'ko', { skillFrames })[0].identities[0].skills
    expect(skills.map(skill => skill.skillId)).toEqual([1010201, 1010203, 1010202, 1010204])
  })
})

describe('REQ-MOTION-020 a new identity without motion yet', () => {
  it('REQ-MOTION-020 lists an identity of the last 30 days that has no motion as pending, at the top of its sinner, and not an older one', () => {
    const info = (game_id: string, name: string, release_date: string) => [game_id, { id: `u${game_id}`, name, sinner_id: 'yi-sang', game_id, folder_name: 'X', release_date }] as const
    const ids = new Map([info('10116', '차원찢개', '2026-08-05'), info('10117', '새 인격', '2026-10-20'), info('10118', '옛 인격', '2026-09-01')])
    const rows = [entry({ slug: 'id10116', identityId: '10116', skillId: 1011601, video: 'yisang/10116/1011601/v-base/layers.mp4' })]
    const yiSang = (now?: Date) => buildMotionCatalog(rows, ids, 'ko', { now }).find(s => s.id === 'yi-sang')!.identities
    const listed = yiSang(new Date('2026-10-21T12:00:00+09:00'))
    expect(listed.map(i => i.slug)).toEqual(['id10117', 'id10116'])
    expect(listed[0]).toMatchObject({ label: '새 인격', pending: true, skills: [] })
    expect(listed[1].pending).toBeFalsy()
    // Without a clock (a test, an old caller) nothing is added.
    expect(yiSang().map(i => i.slug)).toEqual(['id10116'])
  })
})

it('REQ-MOTION-001 builds the list in the browser from the R2 index and the site\'s names, read from R2 at every page open', () => {
  expect(MOTION_INDEX_URL).toBe('https://assets.saigo-no-dante.com/index.json')
  const site = {
    identities: [{ id: 'faust-dawn', name: '새벽 사무소 해결사', sinner_id: 'faust', sinner_name: '파우스트', game_id: '10216', folder_name: 'Dawn', release_date: '2026-01-01' }],
    skillNames: [[1021601, 'Dawn Flash']] as [number, string][],
    skillFrames: [[1021601, { sin: 'wrath', slot: 1, attack: 'slash' }]] as [number, { sin: string; slot: number; attack: 'slash' }][],
    refs: null,
  }
  const catalog = motionCatalogFrom([entry({})], site, 'en', new Date('2026-10-24'))
  const identity = catalog.find(s => s.id === 'faust')!.identities[0]
  expect(identity).toMatchObject({ label: '새벽 사무소 해결사', identityId: 'faust-dawn', gameId: '10216', released: '2026-01-01' })
  expect(identity.skills[0]).toMatchObject({ title: 'Dawn Flash', frame: { sin: 'wrath', slot: 1, attack: 'slash' } })
})

describe('REQ-MOTION-027 the full-colour WebM first', () => {
  const webm = 'faust/10216/1021601/v-base/layers.webm'
  const plays = (answer: string) => (type: string) => (type === VP9_444_TYPE ? answer : '')

  it('REQ-MOTION-027 asks for VP9 profile 1, 4:4:4', () => {
    expect(VP9_444_TYPE).toBe('video/webm; codecs="vp09.01.40.08.03"')
  })

  it('REQ-MOTION-027 tries the WebM, then the MP4, where the browser plays VP9 4:4:4', () => {
    expect(motionVideoFiles({ video: 'a/layers.mp4', videoWebm: webm }, plays('probably'))).toEqual([webm, 'a/layers.mp4'])
    expect(motionVideoFiles({ video: 'a/layers.mp4', videoWebm: webm }, plays('maybe'))).toEqual([webm, 'a/layers.mp4'])
  })

  it('REQ-MOTION-027 keeps the MP4 alone for Safari, entries without a WebM, or after a WebM failed', () => {
    expect(motionVideoFiles({ video: 'a/layers.mp4', videoWebm: webm }, plays(''))).toEqual(['a/layers.mp4'])
    expect(motionVideoFiles({ video: 'a/layers.mp4' }, plays('probably'))).toEqual(['a/layers.mp4'])
    expect(motionVideoFiles({ video: 'a/layers.mp4', videoWebm: webm }, plays('probably'), true)).toEqual(['a/layers.mp4'])
  })

  it('REQ-MOTION-027 passes the index\'s WebM to the state', () => {
    const site = { identities: [{ id: 'faust-dawn', name: '새벽', sinner_id: 'faust', sinner_name: '파우스트', game_id: '10216', folder_name: 'Dawn', release_date: '2026-01-01' }], skillNames: [] as [number, string][], skillFrames: [], refs: null }
    const [withWebm] = motionCatalogFrom([entry({ videoWebm: webm })], site, 'ko', new Date('2026-10-24')).find(s => s.id === 'faust')!.identities[0].skills[0].states
    expect(withWebm.videoWebm).toBe(webm)
    const [without] = motionCatalogFrom([entry({})], site, 'ko', new Date('2026-10-24')).find(s => s.id === 'faust')!.identities[0].skills[0].states
    expect('videoWebm' in without).toBe(false)
  })
})
