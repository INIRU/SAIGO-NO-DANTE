import { describe, expect, it } from 'vitest'
import { deflate } from 'pako'
import {
  GIFT_PRESET_GIFT_LIMIT, GIFT_PRESET_GROUP_LIMIT, GIFT_PRESET_LIMIT, GIFT_PRESET_MEMO_MAX, GIFT_PRESET_NAME_MAX,
  accountPresets, addGroup, createPreset, deletePreset, nextPresetId, normalizePresetBody, normalizePresets, placeGift, presetGiftCount, presetRequest,
  presetSections, presetSyncPlan, presetsFromRows, removeGift, removeGroup, toggleGift, type GiftPreset,
} from '@/features/mirror-dungeon/lib/gift-presets'
import { decodePresetCode, encodePresetCode, giftPresetBodySchema } from '@/features/mirror-dungeon/lib/gift-preset-code'
import type { EgoGift } from '@/features/mirror-dungeon/types'

const gift = (game_id: number) => ({ id: `uuid-${game_id}`, game_id, name: `기프트 ${game_id}`, keyword: '공통', grade: '1', is_synthesis: false }) as EgoGift
const group = (name: string, gifts: string[] = [], memo = '') => ({ name, gifts, memo })
const preset = (groups = [group('최우선 먹기', ['1', '2']), group('있으면 좋음', ['3'])], id = 's1'): GiftPreset => ({ id, name: '화상 덱', groups })
const keys = (count: number, from = 1) => Array.from({ length: count }, (_, i) => String(from + i))

describe('REQ-MIRROR-DUNGEON-019 a preset is a name and up to six named groups', () => {
  it('REQ-MIRROR-DUNGEON-019 reads stored presets back, dropping broken entries and a chosen preset that no longer exists', () => {
    expect(normalizePresets(null)).toEqual({ active: null, list: [] })
    const saved = { active: 'b', list: [preset(), { id: 7 }, 'x', { id: 'c', name: 'x'.repeat(50), groups: 'no' }] }
    expect(normalizePresets(saved)).toEqual({
      active: null,
      list: [preset(), { id: 'c', name: 'x'.repeat(GIFT_PRESET_NAME_MAX), groups: [group('')] }],
    })
    expect(normalizePresets({ ...saved, active: 's1' }).active).toBe('s1')
  })

  it('REQ-MIRROR-DUNGEON-019 reads the older flat list as a preset with one group and keeps more than five of them', () => {
    const old = { active: 'a', list: Array.from({ length: 8 }, (_, i) => ({ id: i ? String(i) : 'a', name: `프리셋 ${i}`, gifts: ['9001', 9002, '9001'] })) }
    const read = normalizePresets(old)
    expect(read.list).toHaveLength(8)
    expect(read.list[0]).toEqual({ id: 'a', name: '프리셋 0', groups: [group('', ['9001', '9002'])] })
    expect(read.active).toBe('a')
    // Nothing the browser already holds is cut on reading, even past today's gift limit.
    expect(normalizePresets({ list: [{ id: 'a', name: '', gifts: keys(80) }] }).list[0].groups[0].gifts).toHaveLength(80)
    // Only making a new one is refused at five or more.
    expect(nextPresetId(read.list)).toBeNull()
    expect(nextPresetId(read.list.slice(0, GIFT_PRESET_LIMIT))).toBeNull()
    expect(nextPresetId([preset(undefined, 's1'), preset(undefined, 's3')])).toBe('s2')
    expect(nextPresetId([])).toBe('s1')
  })

  it('REQ-MIRROR-DUNGEON-019 REQ-MIRROR-DUNGEON-022 a new or imported preset takes the first free slot and is chosen; a sixth is refused', () => {
    const start = normalizePresets({ active: 's1', list: [preset(undefined, 's1'), preset(undefined, 's3')] })
    const made = createPreset(start, '프리셋 3')!
    expect(made.active).toBe('s2')
    expect(made.list.map(item => item.id)).toEqual(['s1', 's2', 's3'])
    expect(made.list[1]).toEqual({ id: 's2', name: '프리셋 3', groups: [group('')] })
    // From a code: the code's own name and groups; a nameless one gets the given name.
    const body = { name: '받은 덱', groups: [group('a', ['1'], '메모')] }
    expect(createPreset(start, '프리셋 3', body)!.list[1]).toEqual({ id: 's2', ...body })
    expect(createPreset(start, '프리셋 3', { ...body, name: '' })!.list[1].name).toBe('프리셋 3')
    const five = { active: null, list: Array.from({ length: GIFT_PRESET_LIMIT }, (_, i) => preset(undefined, `old-${i}`)) }
    expect(createPreset(five, 'x')).toBeNull()
    expect(deletePreset(made, 's2')).toEqual({ active: null, list: start.list })
    expect(deletePreset(made, 's3').active).toBe('s2')
  })

  it('REQ-MIRROR-DUNGEON-019 trims names, memos, groups and gifts to their limits and keeps a gift in its first group only', () => {
    const body = normalizePresetBody({
      name: 'n'.repeat(40),
      groups: [
        { name: 'g'.repeat(40), gifts: ['1', '2', '1'], memo: 'm'.repeat(300) },
        { name: 7, gifts: ['2', '3'], memo: null },
        ...Array.from({ length: 9 }, () => ({ name: '', gifts: [], memo: '' })),
      ],
    })
    expect(body.name).toHaveLength(GIFT_PRESET_NAME_MAX)
    expect(body.groups).toHaveLength(GIFT_PRESET_GROUP_LIMIT)
    expect(body.groups[0]).toEqual(group('g'.repeat(GIFT_PRESET_NAME_MAX), ['1', '2'], 'm'.repeat(GIFT_PRESET_MEMO_MAX)))
    expect(body.groups[1]).toEqual(group('', ['3']))
    expect(normalizePresetBody({ name: 'x', groups: [] }).groups).toEqual([group('')])
    const full = normalizePresetBody({ name: '', groups: [group('a', keys(50)), group('b', keys(50, 51))] })
    expect(full.groups.map(item => item.gifts.length)).toEqual([50, 10])
  })

  it('REQ-MIRROR-DUNGEON-019 a gift put in another group moves there, and sixty is the most a preset holds', () => {
    const start = preset()
    expect(placeGift(start, '9', 1).groups[1].gifts).toEqual(['3', '9'])
    // Already in the first group: it leaves that group.
    const moved = placeGift(start, '1', 1)
    expect(moved.groups.map(item => item.gifts)).toEqual([['2'], ['3', '1']])
    expect(presetGiftCount(moved)).toBe(3)
    // Dropped before another gift, in the same group or a different one.
    expect(placeGift(start, '2', 0, '1').groups[0].gifts).toEqual(['2', '1'])
    expect(placeGift(start, '3', 0, '2').groups.map(item => item.gifts)).toEqual([['1', '3', '2'], []])
    expect(placeGift(start, '1', 0, '1')).toBe(start)
    expect(placeGift(start, '9', 5)).toBe(start)

    const full = preset([group('a', keys(GIFT_PRESET_GIFT_LIMIT)), group('b')])
    expect(placeGift(full, '999', 1)).toBe(full)
    // Moving a gift the preset already holds is not adding one.
    expect(placeGift(full, '1', 1).groups[1].gifts).toEqual(['1'])
  })

  it('REQ-MIRROR-DUNGEON-019 a press puts a gift in the chosen group and a second press takes it out', () => {
    const start = preset()
    const added = toggleGift(start, '9', 0)
    expect(added.groups[0].gifts).toEqual(['1', '2', '9'])
    expect(toggleGift(added, '9', 0).groups[0].gifts).toEqual(['1', '2'])
    // Pressed while another group is chosen: it moves instead of leaving.
    expect(toggleGift(start, '3', 0).groups.map(item => item.gifts)).toEqual([['1', '2', '3'], []])
    expect(removeGift(start, '2').groups[0].gifts).toEqual(['1'])
  })

  it('REQ-MIRROR-DUNGEON-019 groups are added up to six and a preset never has none', () => {
    let current = preset([group('a')])
    for (let i = 0; i < 10; i++) current = addGroup(current)
    expect(current.groups).toHaveLength(GIFT_PRESET_GROUP_LIMIT)
    expect(addGroup(current)).toBe(current)
    expect(removeGroup(preset(), 0).groups).toEqual([group('있으면 좋음', ['3'])])
    expect(removeGroup(preset([group('a', ['1'], '메모')]), 0).groups).toEqual([group('')])
  })
})

describe('REQ-MIRROR-DUNGEON-018 check mode lists a preset by group', () => {
  it('REQ-MIRROR-DUNGEON-018 gives each group its gifts in the order they were placed, skipping gifts the catalog no longer has', () => {
    const a = gift(1), b = gift(2), c = gift(3)
    const sections = presetSections(preset([group('최우선 먹기', ['3', '없는 기프트', '1'], '2층 전에'), group('', ['2'])]), [a, b, c])
    expect(sections).toEqual([{ name: '최우선 먹기', memo: '2층 전에', gifts: [c, a] }, { name: '', memo: '', gifts: [b] }])
  })
})

describe('REQ-MIRROR-DUNGEON-021 account presets', () => {
  it('REQ-MIRROR-DUNGEON-021 turns account rows into presets by slot and ignores rows it cannot read', () => {
    const rows = [{ slot: 3, name: '둘째', groups: [group('a', ['1'])] }, { slot: 9, name: 'x', groups: [] }, null, { slot: 1, name: '첫째', groups: [group('b')] }]
    expect(presetsFromRows(rows)).toEqual([{ id: 's1', name: '첫째', groups: [group('b')] }, { id: 's3', name: '둘째', groups: [group('a', ['1'])] }])
    expect(presetsFromRows('nope')).toEqual([])
  })

  it('REQ-MIRROR-DUNGEON-021 uploads the first five browser presets, within the limits, and keeps the chosen one chosen', () => {
    const browser = normalizePresets({ active: '2', list: Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `p${i}`, gifts: keys(i === 0 ? 80 : 2) })) })
    const account = accountPresets(browser)
    expect(account.list.map(item => item.id)).toEqual(['s1', 's2', 's3', 's4', 's5'])
    expect(account.active).toBe('s3')
    expect(account.list[0].groups[0].gifts).toHaveLength(GIFT_PRESET_GIFT_LIMIT)
    expect(accountPresets({ active: '6', list: browser.list }).active).toBeNull()
  })

  it('REQ-MIRROR-DUNGEON-021 saves only the slots that changed and deletes the ones that are gone', () => {
    const first = preset(), second = preset([group('b')], 's2'), third = preset([group('c')], 's4')
    const synced = new Map([first, second, third].map(item => [Number(item.id.slice(1)), presetRequest(item)!]))
    expect(presetSyncPlan(synced, [first, second, third])).toEqual({ puts: [], deletes: [] })
    const renamed = { ...second, name: '새 이름' }
    const plan = presetSyncPlan(synced, [first, renamed, { id: 'browser-only', name: 'x', groups: [group('')] }])
    expect(plan.deletes).toEqual([4])
    expect(plan.puts).toEqual([{ slot: 2, body: presetRequest(renamed) }])
    expect(JSON.parse(plan.puts[0].body)).toEqual({ slot: 2, name: '새 이름', groups: [group('b')] })
    expect(presetSyncPlan(new Map(), [first]).puts).toHaveLength(1)
  })

  it('REQ-MIRROR-DUNGEON-021 the request check refuses bodies outside the limits', () => {
    const ok = { name: '화상 덱', groups: [group('a', ['9001', '9002'], '메모')] }
    expect(giftPresetBodySchema.safeParse(ok).success).toBe(true)
    expect(giftPresetBodySchema.safeParse({ name: '', groups: [group('')] }).success).toBe(true)
    for (const bad of [
      { name: 'n'.repeat(21), groups: [group('')] },
      { name: 'x', groups: [] },
      { name: 'x', groups: Array.from({ length: 7 }, () => group('')) },
      { name: 'x', groups: [group('g'.repeat(21))] },
      { name: 'x', groups: [group('', [], 'm'.repeat(101))] },
      { name: 'x', groups: [group('', ['1', '1'])] },
      { name: 'x', groups: [group('', ['1']), group('', ['1'])] },
      { name: 'x', groups: [group('', keys(40)), group('', keys(21, 41))] },
      { name: 'x', groups: [group('', ['<script>'])] },
      { name: 'x', groups: [{ name: '', gifts: 'no', memo: '' }] },
    ]) expect(giftPresetBodySchema.safeParse(bad).success, JSON.stringify(bad).slice(0, 60)).toBe(false)
  })
})

describe('REQ-MIRROR-DUNGEON-022 preset code', () => {
  it('REQ-MIRROR-DUNGEON-022 a preset survives the trip through its code', () => {
    const source = preset([group('최우선 먹기', ['9001', '9002'], '2층 전에 먹기\n없으면 넘김'), group('', ['9003'])])
    const code = encodePresetCode(source)
    expect(code).toMatch(/^[\w-]+$/)
    expect(decodePresetCode(`  ${code}\n`)).toEqual({ name: '화상 덱', groups: source.groups })
    // The fullest preset still fits under the length cap.
    const largest = { name: '가'.repeat(20), groups: Array.from({ length: 6 }, (_, i) => group('나'.repeat(20), keys(10, 9000 + i * 10), '다라마바사'.repeat(20))) }
    expect(decodePresetCode(encodePresetCode(largest))).toEqual(largest)
  })

  it('REQ-MIRROR-DUNGEON-022 refuses a broken, oversized or out-of-limit code', () => {
    const pack = (value: unknown) => btoa(String.fromCharCode(...deflate(JSON.stringify(value)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
    expect(decodePresetCode('')).toBeNull()
    expect(decodePresetCode('not a code!')).toBeNull()
    expect(decodePresetCode(encodePresetCode(preset()).slice(4))).toBeNull()
    expect(decodePresetCode('A'.repeat(9000))).toBeNull()
    expect(decodePresetCode(pack({ v: 2, n: 'x', g: [['', '', []]] }))).toBeNull()
    expect(decodePresetCode(pack({ v: 1, n: 'x', g: [['', '', ['1', '1']]] }))).toBeNull()
    expect(decodePresetCode(pack({ v: 1, n: 'x'.repeat(21), g: [['', '', []]] }))).toBeNull()
    expect(decodePresetCode(pack('x'.repeat(50000)))).toBeNull()
    expect(decodePresetCode(pack({ v: 1, n: 'x', g: [['a', '', ['1']]] }))).toEqual({ name: 'x', groups: [group('a', ['1'])] })
  })
})
