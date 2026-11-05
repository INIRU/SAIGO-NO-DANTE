import { describe, expect, it } from 'vitest'
import { buildMotionCatalog, defaultMotionState, findMotionSkill, isMotionEgo, motionCatalogFrom, motionChapterLabel, MOTION_INDEX_URL, cutinAllyId, formatMotionLabelKey, motionAssetUrl, motionSinnerId, motionStateLabel, type MotionChapterWords, type MotionEgoInfo, type MotionEntry } from '@/lib/motion/catalog'

const entry = (over: Partial<MotionEntry>): MotionEntry => ({
  slug: 'id10216', skillId: 1021601, state: 'v:base', identity: '새벽 사무소 해결사 파우스트', name: '여명의 섬광',
  layers: 1, audio: true, frames: 159, fps: 60, bytes: 100, video: 'faust/10216/1021601/v-base/layers.mp4', meta: 'faust/10216/1021601/v-base/layers.json', ...over,
})

describe('REQ-MOTION-001 the motion list is read from the R2 index', () => {
  it('REQ-MOTION-001 keys a skill by slug and skill id, so a link or LCB entry never takes another identity\'s states', () => {
    const rows = [
      entry({}),
      entry({ state: 'v:best', name: '여명의 섬광 [최고 상태 (관 3단계)]', video: 'faust/10216/1021601/v-best/layers.mp4', meta: 'faust/10216/1021601/v-best/layers.json' }),
    ]
    const catalog = buildMotionCatalog(rows, new Map(), 'ko')
    const faust = catalog.find(s => s.id === 'faust')!
    expect(faust.identities.map(i => i.slug)).toEqual(['id10216'])
    expect(faust.identities[0].skills[0].states.map(s => s.state)).toEqual(['v:base', 'v:best'])
  })

  it('REQ-MOTION-001 maps the R2 sinner folders and the link slugs to the site\'s sinner ids', () => {
    expect(motionSinnerId(entry({ video: 'yisang/10101/1010101/v-base/layers.mp4' }))).toBe('yi-sang')
    expect(motionSinnerId(entry({ video: 'donquixote/10301/x/layers.mp4' }))).toBe('don-quixote')
    expect(motionSinnerId(entry({ video: 'honglu/10601/x/layers.mp4' }))).toBe('hong-lu')
    // A link slug without a sinner in it: the skill id's first digits name the sinner.
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
    entry({ state: 'v:best-2', name: 'x [최고 상태 (a)]', label: '최고 상태 (a)' }), entry({ state: 'v:case2', name: 'x [관 2단계]', label: '관 2단계' }), entry({ state: 'v:base', label: '기본' }),
  ]
  it('REQ-MOTION-002 orders base, then the conditions, then the best state, and labels them', () => {
    const [sinner] = buildMotionCatalog(states, new Map(), 'ko')
    const got = sinner.identities[0].skills[0].states
    expect(got.map(s => s.state)).toEqual(['v:base', 'v:case2', 'v:best-2'])
    expect(got.map(s => s.label)).toEqual(['기본', '관 2단계', '최고 상태 (a)'])
  })
  it('REQ-MOTION-002 opens on the best state when there is one, else on base', () => {
    const [sinner] = buildMotionCatalog(states, new Map(), 'ko')
    expect(defaultMotionState(sinner.identities[0].skills[0])).toBe('v:best-2')
    const [plain] = buildMotionCatalog([entry({}), entry({ state: 'v:case2', name: 'x [관 2단계]' })], new Map(), 'ko')
    expect(defaultMotionState(plain.identities[0].skills[0])).toBe('v:base')
  })
  it('REQ-MOTION-002 never makes a label from the state name or the brackets of the name, nor reads the old names', () => {
    expect(motionStateLabel(entry({ state: 'v:case2', name: 'x [관 2단계]' }), 'ko')).toBe('v:case2')
    // The old names are gone from the index: no special meaning, no fixed text.
    expect(motionStateLabel(entry({ state: 'max', name: '연계 [최대 상태]' }), 'en')).toBe('max')
    const [old] = buildMotionCatalog([entry({ state: 'max', label: 'M' }), entry({ state: 'base', label: 'B' }), entry({ state: 'v:kill', label: 'K' })], new Map(), 'ko')
    expect(old.identities[0].skills[0].states.map(s => s.state)).toEqual(['base', 'max', 'v:kill'])
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

  it('REQ-MOTION-002 writes the label of the page language, and the Korean label as it is when that one is missing', () => {
    expect(motionStateLabel(entry({ state: 'v:best-2', label: '최고 상태', labelEn: 'Best State', labelJa: '最高状態' }), 'en')).toBe('Best State')
    expect(motionStateLabel(entry({ state: 'v:best-2', label: '최고 상태', labelEn: 'Best State', labelJa: '最高状態' }), 'ja')).toBe('最高状態')
    expect(motionStateLabel(entry({ state: 'v:case2', label: '관 2단계' }), 'ja')).toBe('관 2단계')
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

describe('REQ-MOTION-014 condition labels from labelKey', () => {
  it('REQ-MOTION-014 writes a labelKey with the site keyword table, and gives nothing back for a key it cannot resolve', () => {
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
    expect(states[1].link).toMatchObject({ id: '10114', max: false, partners: [{ gameId: '10114', name: '흑수 - 오 필두', sinner: '이상' }] })
    expect(states[1].link!.partners[0].portrait).toContain('10114')
    expect(states[2].link).toMatchObject({ id: '10114', max: true })
  })

  const info = (game_id: string, sinner_id: string, sinner_name: string) => [game_id, { id: `u${game_id}`, name: `n${game_id}`, sinner_id, sinner_name, game_id, folder_name: 'f', release_date: '2025-08-28' }] as const
  const ids = new Map([info('10216', 'faust', '파우스트'), info('11216', 'gregor', '그레고르'), info('11009', 'sinclair', '싱클레어'), info('10715', 'heathcliff', '히스클리프')])

  it('REQ-MOTION-033 gives a link every member but the identity itself, in the index order, under one link id', () => {
    const [faust] = buildMotionCatalog([entry({ identityId: '10216', skillId: 1021603, state: 'v:link-11216+11009', label: 'L', members: ['10216', '11216', '11009'], linkMax: false })], ids, 'ko')
    const link = faust.identities[0].skills[0].states[0].link!
    expect(link.partners.map(p => p.gameId)).toEqual(['11216', '11009'])
    expect(link.id).toBe('11216+11009')
  })

  it('REQ-MOTION-033 keeps a link with no partner (v:link-self) a plain state', () => {
    const [heath] = buildMotionCatalog([entry({ slug: 'id10715', identityId: '10715', skillId: 1071503, state: 'v:link-self', label: '연계', members: ['10715'], linkMax: false, video: 'heathcliff/10715/1071503/v-link-self/layers.mp4' })], ids, 'ko')
    expect(heath.identities[0].skills[0].states[0].link).toBeUndefined()
  })
})

describe('REQ-MOTION-046 the dead 거미집 아비 of 공간참 - 잔', () => {
  const info = (game_id: string, sinner_id: string, sinner_name: string) => [game_id, { id: `u${game_id}`, name: `아비 ${game_id}`, sinner_id, sinner_name, game_id, folder_name: 'f', release_date: '2025-08-28' }] as const
  const ids = new Map([info('10916', 'rodion', '로쟈'), info('10115', 'yi-sang', '이상'), info('11115', 'outis', '오티스'), info('10614', 'hong-lu', '홍루')])
  const row = (state: string, deadAllies?: string[]) => entry({ slug: 'id10415', identityId: '10415', skillId: 1041507, state, label: state, video: `ryoshu/10415/1041507/${state}/layers.mp4`, ...(deadAllies && { deadAllies }) })
  const rows = [row('v:base'), row('v:best-3'), row('v:dead-10916', ['10916']), row('v:dead-10916+dead-10115+dead-11115+dead-10614', ['10916', '10115', '11115', '10614'])]

  it('REQ-MOTION-046 gives a dead state its dead identities (name, sinner, portrait), in the index order', () => {
    const [ryoshu] = buildMotionCatalog(rows, ids, 'ko')
    const states = ryoshu.identities[0].skills[0].states
    expect(states.find(s => s.state === 'v:base')!.dead).toBeUndefined()
    expect(states.find(s => s.state === 'v:dead-10916')!.dead!.map(d => d.gameId)).toEqual(['10916'])
    const all = states.find(s => s.state.endsWith('10614'))!.dead!
    expect(all.map(d => d.sinner)).toEqual(['로쟈', '이상', '오티스', '홍루'])
    expect(all[0].portrait).toContain('10916')
  })

})


describe('REQ-MOTION-044 a skill carries its frame', () => {
  it('REQ-MOTION-044 gives a skill the sin, slot and attack type of its site row, and none when the site has no row', () => {
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
    egos: [],
    refs: null,
  }
  const catalog = motionCatalogFrom([entry({})], site, 'en', new Date('2026-10-24'))
  const identity = catalog.find(s => s.id === 'faust')!.identities[0]
  expect(identity).toMatchObject({ label: '새벽 사무소 해결사', identityId: 'faust-dawn', gameId: '10216', released: '2026-01-01' })
  expect(identity.skills[0]).toMatchObject({ title: 'Dawn Flash', frame: { sin: 'wrath', slot: 1, attack: 'slash' } })
})

it('REQ-MOTION-015 names and frames a skill saved under another identity\'s sprite id from the row its identity borrowed', () => {
  const site = {
    identities: [{ id: 'yisang-n', name: 'N사 E.G.O:: 경멸, 경외', sinner_id: 'yisang', sinner_name: '이상', game_id: '10412', folder_name: 'N', release_date: '2026-01-01' }],
    skillNames: [[1011303, '대상 조정 사격']] as [number, string][],
    skillFrames: [[1011303, { sin: 'gloom', slot: 3, attack: 'pierce' }]] as [number, { sin: string; slot: number; attack: 'pierce' }][],
    skillBorrowed: [['10412', { name: '쏘아내겠소 / 언제든지', frame: { sin: 'pride', slot: 3, attack: 'pierce', sprite: 1011303 } }]] as [string, { name?: string; frame: { sin: string; slot: number; attack: 'pierce'; sprite: number } }][],
    egos: [],
    refs: null,
  }
  const linked = entry({ slug: 'id10412', skillId: 1041206, state: 'v:link', identity: 'N사 E.G.O:: 경멸, 경외 이상', name: '쏘아내겠소 / 언제든지', video: 'yisang/10412/1041206/v-link/layers.mp4', meta: 'yisang/10412/1041206/v-link/layers.json' })
  const [skill] = motionCatalogFrom([linked], site, 'ko', new Date('2026-10-24'))[0].identities[0].skills
  expect(skill).toMatchObject({ title: '쏘아내겠소 / 언제든지', frame: { sin: 'pride', slot: 3, attack: 'pierce', sprite: 1011303 } })
})

describe('REQ-MOTION-042 E.G.O under the sinner', () => {
  const ego = (over: Partial<MotionEntry>): MotionEntry => entry({
    ego: true, egoId: 20211, sinner: 'faust', grade: 'ZAYIN', erode: false, slug: 'ego-faust', skillId: 2021112, identity: '이름 없는 에고', name: '에고 스킬',
    video: 'faust/ego/2021112/v-base/layers.mp4', meta: 'faust/ego/2021112/v-base/layers.json', ...over,
  })
  const info = (game_id: string, name: string, grade: string, sin_affinity: string | null): [string, MotionEgoInfo] => [game_id, { game_id, name, image_url: `https://img/${game_id}.webp`, grade, sinner_id: 'faust', sin_affinity }]
  const egos = new Map([info('20211', '에고 하나', 'ZAYIN', 'gloom'), info('20215', '에고 둘', 'WAW', 'wrath'), info('20213', '에고 셋', 'ZAYIN', null)])
  const rows = [
    entry({}),
    ego({ egoId: 20215, grade: 'WAW', slug: 'ego-faust-b', skillId: 2021512, video: 'faust/ego/2021512/v-base/layers.mp4' }),
    ego({ skillId: 2021113, erode: true, video: 'faust/ego/2021113/v-base/layers.mp4' }),
    ego({}),
    ego({ egoId: 20213, slug: 'ego-faust-c', skillId: 2021312, video: 'faust/ego/2021312/v-base/layers.mp4' }),
  ]
  const faust = () => buildMotionCatalog(rows, new Map(), 'ko', { egos }).find(s => s.id === 'faust')!

  it('REQ-MOTION-042 keeps an E.G.O entry out of the identity rules and puts it in the sinner\'s egos, one card per egoId', () => {
    expect(faust().identities.map(i => i.slug)).toEqual(['id10216'])
    expect(faust().egos.map(e => e.egoId)).toEqual([20213, 20211, 20215])
  })

  it('REQ-MOTION-042 orders the E.G.O by grade, then egoId descending, and its skills awakening first, then erosion', () => {
    expect(faust().egos.map(e => [e.grade, e.egoId])).toEqual([['ZAYIN', 20213], ['ZAYIN', 20211], ['WAW', 20215]])
    expect(faust().egos[1].skills.map(s => [s.skillId, s.erode])).toEqual([[2021112, false], [2021113, true]])
  })

  it('REQ-MOTION-042 names an E.G.O and its picture from the site by game id, with the slug and skill id as the skill key', () => {
    const one = faust().egos[1]
    expect(one).toMatchObject({ label: '에고 하나', image: 'https://img/20211.webp', sin: 'gloom' })
    expect(one.skills[0].key).toBe('ego-faust|2021112')
    expect(one.skills[0].states[0].video).toBe('faust/ego/2021112/v-base/layers.mp4')
  })

  it('REQ-MOTION-042 gives an E.G.O skill the frame of its sin in slot 3, the neutral one without a sin, and names it from the index without a site row', () => {
    expect(faust().egos[1].skills[0].frame).toEqual({ sin: 'gloom', slot: 3, attack: null })
    expect(faust().egos[0].skills[0].frame).toEqual({ sin: 'neutral', slot: 3, attack: null })
    const [bare] = buildMotionCatalog([ego({})], new Map(), 'ko')
    expect(bare.egos[0]).toMatchObject({ egoId: 20211, grade: 'ZAYIN', label: '이름 없는 에고', image: null, sin: null })
  })

  it('REQ-MOTION-042 lists a sinner that has E.G.O only, and one that has identities only with no egos', () => {
    const only = buildMotionCatalog([ego({ sinner: 'yisang', video: 'yisang/ego/2021112/v-base/layers.mp4', slug: 'ego-yisang' })], new Map(), 'ko')
    expect(only.map(s => [s.id, s.identities.length, s.egos.length])).toEqual([['yi-sang', 0, 1]])
    expect(buildMotionCatalog([entry({})], new Map(), 'ko')[0].egos).toEqual([])
  })

  it('REQ-MOTION-042 finds the sinner of an E.G.O by its folder', () => {
    expect(motionSinnerId(ego({ video: 'donquixote/ego/2031112/v-base/layers.mp4' }))).toBe('don-quixote')
  })

  it('REQ-MOTION-042 builds the E.G.O in the browser from the site data', () => {
    const site = { identities: [], skillNames: [[2021112, 'Ego Skill']] as [number, string][], skillFrames: [] as [number, never][], refs: null, egos: [egos.get('20211')!] }
    const [f] = motionCatalogFrom([ego({})], site, 'en', new Date('2026-10-24'))
    expect(f.egos[0]).toMatchObject({ label: '에고 하나' })
    expect(f.egos[0].skills[0].title).toBe('Ego Skill')
  })

  it('REQ-MOTION-042 finds a skill of an identity or an E.G.O from its address, with its owner', () => {
    const sinners = buildMotionCatalog(rows, new Map(), 'ko', { egos })
    const own = findMotionSkill(sinners, 'id10216~1021601')!
    expect(own).toMatchObject({ sinnerId: 'faust', skill: { key: 'id10216|1021601' } })
    expect(isMotionEgo(own.owner)).toBe(false)
    expect(own.owner.label).toBe('새벽 사무소 해결사 파우스트')
    const found = findMotionSkill(sinners, 'ego-faust~2021113')!
    expect(found).toMatchObject({ sinnerId: 'faust', skill: { skillId: 2021113, erode: true } })
    expect(isMotionEgo(found.owner)).toBe(true)
    expect(found.owner.label).toBe('에고 하나')
    expect(findMotionSkill(sinners, 'ego-faust~1')).toBeNull()
  })
})

describe('REQ-MOTION-043 an identity carries what the site card needs', () => {
  it('REQ-MOTION-043 gives an identity its rarity and folder name, null when the site has no row', () => {
    const identities = new Map([['10216', { id: 'u', name: 'n', sinner_id: 'faust', game_id: '10216', folder_name: 'Dawn', rarity: 3 }]])
    const [faust] = buildMotionCatalog([entry({}), entry({ slug: 'id10299', skillId: 1029901, video: 'faust/10299/1029901/v-base/layers.mp4' })], identities, 'ko')
    expect(faust.identities.find(i => i.slug === 'id10216')).toMatchObject({ rarity: 3, folderName: 'Dawn' })
    expect(faust.identities.find(i => i.slug === 'id10299')).toMatchObject({ rarity: null, folderName: null })
  })
})

describe('REQ-MOTION-041 chapter names', () => {
  const words: MotionChapterWords = { skill: '스킬', form: '폼', cutin: '컷인', coin: '코인 {n}', reuse: '재사용', part: '파트 {n}', weight: '가중', sp: 'SP', resonance: '공명', dead: '사망', break: '파괴' }
  const at = (key: string, kind = 'skill', skillName?: string) => motionChapterLabel({ kind, key }, words, () => skillName)

  it('REQ-MOTION-041 names a chapter by its token: the skill by its name, the coin and part by their number, the rest from the words', () => {
    expect(at('<s:2021112>', 'skill', '여명의 섬광')).toBe('여명의 섬광')
    expect(at('<s:2021112>')).toBe('스킬')
    expect(at('<coin:3>', 'coin')).toBe('코인 3')
    expect(at('<part:2>', 'part')).toBe('파트 2')
    for (const [key, name] of [['<form>', '폼'], ['<cutin>', '컷인'], ['<weight>', '가중'], ['<sp>', 'SP'], ['<resonance>', '공명'], ['<dead>', '사망'], ['<break>', '파괴']]) expect(at(key, 'form')).toBe(name)
  })

  it('REQ-MOTION-041 falls back to the general name of the chapter kind for a token it does not know', () => {
    expect(at('<mystery:7>', 'reuse')).toBe('재사용')
    expect(at('<mystery>', 'coin')).toBe('코인')
    expect(at('plain', 'part')).toBe('파트')
  })
})

describe('REQ-MOTION-046 the buffs of a scenario', () => {
  const refs = { Burst: { k: 'keyword' as const, n: '파열', kw: '파열', i: 'rupture' }, Odd: { k: 'keyword' as const, n: '이상한 표식' } }
  const states = (conditions: MotionEntry['conditions']) => buildMotionCatalog([entry({ state: 'v:1', conditions })], new Map(), 'ko', { refs })[0].identities[0].skills[0].states

  it('REQ-MOTION-046 names each condition from the keyword table with its icon and stack, the target in the page language', () => {
    const [state] = states([{ keyword: 'Burst', stack: 10, target: true }, { keyword: 'Odd', stack: 5, target: false }])
    expect(state.conditions?.map(c => [c.name, c.stack])).toEqual([['대상 파열', '10'], ['이상한 표식', '5']])
    expect(state.conditions?.[0].icon).toContain('/icons/keywords/rupture.webp')
    expect(state.conditions?.[1].icon).toBeNull()
  })

  it('REQ-MOTION-046 keeps the words of the labelKey the conditions do not show, in the page language', () => {
    const extras = (labelKey: string, conditions: MotionEntry['conditions'], lang = 'ko') => buildMotionCatalog([entry({ state: 'v:1', labelKey, conditions })], new Map(), lang, { refs })[0].identities[0].skills[0].states[0].extras?.map(extra => extra.text)
    expect(extras('[Burst] 10 + <crit> · <weight> 3', [{ keyword: 'Burst', stack: 10, target: false }])).toEqual(['치명타', '가중치 3'])
    expect(extras('[Burst] 10 + <crit>', [{ keyword: 'Burst', stack: 10, target: false }], 'en')).toEqual(['Critical Hit'])
    expect(extras('[Burst] 10', undefined)).toEqual(['파열 10'])
    expect(extras('<ally> <i:10412> + <crit>', undefined)).toEqual(['치명타'])
  })

  it('REQ-MOTION-055 writes the sin with the site sin icon and joins it to the resonance after it, the coin face and a small target in words', () => {
    const extras = (labelKey: string, lang = 'ko') => buildMotionCatalog([entry({ state: 'v:1', labelKey })], new Map(), lang, { refs })[0].identities[0].skills[0].states[0].extras
    const [sin, weight] = extras('<sin:scarlet> + <resonance> 4 · <weight> 2')!
    expect(sin).toMatchObject({ text: '색욕 공명 4' })
    expect(sin.icon).toContain('/assets/game-ui/sins/lust.webp')
    expect(weight).toEqual({ text: '가중치 2', icon: null })
    expect(extras('<sin:crimson> + <resonance> 3', 'ja')![0].text).toBe('憤怒 共鳴 3')
    expect(extras('<sin:azure>', 'en')![0]).toMatchObject({ text: 'Gloom' })
    const [tail] = extras('<coin:tail>')!
    expect(tail.text).toBe('코인 뒷면')
    expect(tail.icon).toContain('/assets/game-ui/coins/normal.webp')
    expect(extras('<coin:head>', 'en')![0].text).toBe('Heads')
    expect(extras('<target> <small>')![0]).toEqual({ text: '대상 소형', icon: null })
  })

  it('REQ-MOTION-055 takes a keyword value as written, a string such as 1/15, and no number for a stage', () => {
    const [state] = buildMotionCatalog([entry({ state: 'v:1', conditions: [{ keyword: 'Burst', stack: '1/15', target: false }, { keyword: 'Burst', target: false }] })], new Map(), 'ko', { refs })[0].identities[0].skills[0].states
    expect(state.conditions?.map(c => c.stack)).toEqual(['1/15', null])
  })

  it('REQ-MOTION-046 leaves out a keyword the table does not know, and keeps a scenario without conditions plain', () => {
    expect(states([{ keyword: 'Nope', target: false }])[0].conditions).toEqual([])
    expect(states(undefined)[0].conditions).toBeUndefined()
  })

  it('REQ-MOTION-046 gives an ally formation its identity', () => {
    const [info] = [{ id: 'a', name: '경멸, 경외', sinner_id: 'ryoshu', sinner_name: '료슈', game_id: '10412', folder_name: 'F' }]
    const list = buildMotionCatalog([entry({ state: 'v:with-10412' })], new Map([['10412', info]]), 'ko')
    expect(list[0].identities[0].skills[0].states[0].allies).toMatchObject([{ gameId: '10412', name: '경멸, 경외', sinner: '료슈' }])
  })

  it('REQ-MOTION-056 takes the allies of a scenario from its labelKey too, every one once, and a dead one only as dead', () => {
    const allies = (over: Partial<MotionEntry>) => buildMotionCatalog([entry(over)], new Map(), 'ko')[0].identities[0].skills[0].states[0]
    expect(allies({ state: 'v:best', labelKey: '[X] 30 + [Y] 3 + <i:11216>' }).allies?.map(p => p.gameId)).toEqual(['11216'])
    expect(allies({ state: 'v:with-both', labelKey: '<i:10216> + <i:11216>' }).allies?.map(p => p.gameId)).toEqual(['10216', '11216'])
    expect(allies({ state: 'v:with-11216', labelKey: '<i:11216>' }).allies?.map(p => p.gameId)).toEqual(['11216'])
    const dead = allies({ state: 'v:dead-10115', labelKey: '[Shin] 1 + <i:10115>', deadAllies: ['10115'] })
    expect(dead.allies).toBeUndefined()
    expect(dead.dead?.map(p => p.gameId)).toEqual(['10115'])
    expect(allies({ state: 'v:link-10115', labelKey: '<i:10115>', members: ['10216', '10115'] }).allies).toBeUndefined()
  })
})

describe('REQ-MOTION-041 the word tokens of a label', () => {
  const refs = { Charge: { k: 'keyword' as const, n: 'Charge' } }

  it('REQ-MOTION-041 writes the tokens in the page language and keeps the numbers and separators', () => {
    expect(formatMotionLabelKey('<resonance> 2 · <weight> 4', refs, () => undefined, 'ko')).toBe('공명 2 · 가중치 4')
    expect(formatMotionLabelKey('<target> [Charge] 2 + <crit>', refs, () => undefined, 'en')).toBe('Target Charge 2 + Critical Hit')
    expect(formatMotionLabelKey('<hp> 49% · <coin> 3 <reuse>', refs, () => undefined, 'ja')).toBe('HP 49% · コイン 3 再使用')
    expect(formatMotionLabelKey('<coin:2> <kill> <part:3> <coin:last>', refs, () => undefined, 'ko')).toBe('코인 2 처치 3부 마지막 코인')
    expect(formatMotionLabelKey('<ally> <i:10412>', refs, () => '경멸, 경외', 'ko')).toBe('아군 경멸, 경외')
  })
})

describe('REQ-MOTION-042 awakening and corrosion', () => {
  it('REQ-MOTION-042 keeps two awakening skills together and sets the corrosion apart as a form, with names and frames from the site', () => {
    const ego = (skillId: number, erode: boolean) => entry({ ego: true, egoId: 20211, sinner: 'faust', grade: 'ZAYIN', erode, slug: 'ego-faust', skillId, identity: 'E', video: 'faust/ego/1/v-base/layers.mp4' })
    const [sinner] = buildMotionCatalog([ego(2021113, true), ego(2021112, false), ego(2021111, false)], new Map(), 'ko', { skillNames: new Map([[2021111, '구멍(le trou)']]), skillFrames: new Map([[2021111, { sin: 'pride', slot: 3, attack: 'pierce' as const }]]) })
    const skills = sinner.egos[0].skills
    expect(skills.map(s => [s.skillId, s.form])).toEqual([[2021111, null], [2021112, null], [2021113, 'erode']])
    expect(skills[0]).toMatchObject({ title: '구멍(le trou)', frame: { sin: 'pride', attack: 'pierce' } })
  })
})

describe('REQ-MOTION-046 the ally of a cut-in', () => {
  it('REQ-MOTION-046 reads it from the first chapter skill of another identity', () => {
    expect(cutinAllyId([{ key: '<s:1020101>' }, { key: '<coin:0> <reuse>' }], '10116')).toBe('10201')
    expect(cutinAllyId([{ key: '<s:1011601>' }, { key: '<s:1020101>' }], '10116')).toBe('10201')
    expect(cutinAllyId([{ key: '<s:1011601>' }], '10116')).toBeNull()
    expect(cutinAllyId(undefined, '10116')).toBeNull()
  })
})

it('REQ-MOTION-037 the base state is named in the page language when the index has only its Korean label', () => {
  const base = entry({ state: 'v:base', label: '기본' })
  expect(motionStateLabel(base, 'ko')).toBe('기본')
  expect(motionStateLabel(base, 'en')).toBe('Normal')
  expect(motionStateLabel(base, 'ja')).toBe('通常')
  // The index's own English or Japanese label still wins.
  expect(motionStateLabel({ ...base, labelEn: 'Base' }, 'en')).toBe('Base')
})
