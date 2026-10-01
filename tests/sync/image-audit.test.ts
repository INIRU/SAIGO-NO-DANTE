import { describe, expect, it } from 'vitest'
import { STORAGE_BASE } from '@/lib/constants/game'
import { IMAGE_AUDIT_KINDS, auditImages, auditImagesSafely, formatMissingImages, supabaseAuditSource, type AuditSource } from '@/scripts/sync/image-audit'

const url = (key: string) => `${STORAGE_BASE}/${key}`

/** Rows per table and the files per Storage folder; every row read and folder listed is recorded. */
function fakeSource(tables: Record<string, Record<string, unknown>[]>, folders: Record<string, string[]>) {
  const read: { table: string; columns: string }[] = [], listed: string[] = []
  const source: AuditSource = {
    rows: async (table, columns) => { read.push({ table, columns }); return tables[table] ?? [] },
    list: async dir => { listed.push(dir); return new Set(folders[dir] ?? []) },
  }
  return { source, read, listed }
}

const RYOSHU = { id: 'i1', game_id: '10412', sinner_id: 'ryoshu' }
const skill = (id: string, image_id: string, uptie_level = 4) => ({ id, identity_id: 'i1', image_id, skill_order: 1, uptie_level })

const TABLES = {
  keyword_meta: [
    { name: '잿빛 탄환', icon_slug: 'ashen-bullet' }, // own file, missing
    { name: '검은 날개', icon_slug: 'black-wings' }, // own file, present
    { name: '두번째 마탄', icon_slug: 'the-second-magic-bullet' }, // alias target the-seconds-magic-bullet.webp, present
    { name: '경멸의 시선', icon_slug: 'gaze-of-contempt' }, // alias target gaze-of-the-contempt.webp, missing
    { name: '천퇴성[天退星]', icon_slug: 'tiantui-star' }, // local asset
    { name: '없음', icon_slug: null },
  ],
  identities: [RYOSHU],
  skills: [skill('a', '1041205', 3), skill('b', '1041205', 4), skill('c', '1041201')],
  ego_gifts: [{ image_url: url('ego-gifts/ego-gift-1.webp') }, { image_url: url('ego-gifts/ego-gift-2.webp') }, { image_url: null }],
  ego_gift_themes: [{ image_url: url('icons/theme-packs/1122.webp'), boss_image_url: url('icons/theme-packs/boss/missing.webp') }, { image_url: url('icons/theme-packs/1123.webp') }],
  md_events: [{ image_url: url('icons/events/901001.webp?v=3') }, { image_url: 'https://elsewhere.test/a.webp' }],
}
const FOLDERS = {
  'icons/keywords': ['black-wings.webp', 'the-seconds-magic-bullet.webp'],
  'icons/skills/ryoshu': ['1041201.webp'],
  'ego-gifts': ['ego-gift-1.webp'],
  'icons/theme-packs': ['1122.webp'],
  'icons/events': ['901001.webp'],
}

describe('REQ-DATA-SYNC-042 the image audit', () => {
  it('REQ-DATA-SYNC-042 checks every key the DB references (as the site reads it) and groups the missing ones by kind', async () => {
    const { source } = fakeSource(TABLES, FOLDERS)
    const result = await auditImages(source)
    expect(Object.keys(result)).toEqual([...IMAGE_AUDIT_KINDS])
    expect(result.keywords).toEqual({ checked: 4, missing: 2, keys: ['icons/keywords/ashen-bullet.webp', 'icons/keywords/gaze-of-the-contempt.webp'] })
    expect(result.skills).toEqual({ checked: 2, missing: 1, keys: ['icons/skills/ryoshu/1041205.webp'] })
    expect(result.gifts).toEqual({ checked: 2, missing: 1, keys: ['ego-gifts/ego-gift-2.webp'] })
    expect(result.themePacks).toEqual({ checked: 2, missing: 1, keys: ['icons/theme-packs/1123.webp'] })
    expect(result.events).toEqual({ checked: 1, missing: 0, keys: [] })
  })

  it('REQ-DATA-SYNC-042 leaves theme pack boss images out and reads only the columns it needs', async () => {
    const { source, read } = fakeSource(TABLES, FOLDERS)
    const result = await auditImages(source)
    expect(result.themePacks.keys).not.toContain('icons/theme-packs/boss/missing.webp')
    expect(read.find(item => item.table === 'ego_gift_themes')?.columns).toBe('image_url')
  })

  it('REQ-DATA-SYNC-042 lists each Storage folder once and only the folders the references need', async () => {
    const { source, listed } = fakeSource(TABLES, FOLDERS)
    await auditImages(source)
    expect([...listed].sort()).toEqual(['ego-gifts', 'icons/events', 'icons/keywords', 'icons/skills/ryoshu', 'icons/theme-packs'])
  })

  it('REQ-DATA-SYNC-042 local keyword assets are checked only when the caller can look for them', async () => {
    const { source } = fakeSource({ keyword_meta: [{ name: '천퇴성[天退星]', icon_slug: 'tiantui-star' }] }, {})
    expect((await auditImages(source)).keywords).toEqual({ checked: 0, missing: 0, keys: [] })
    const found = await auditImages(source, { localExists: () => true })
    expect(found.keywords).toEqual({ checked: 1, missing: 0, keys: [] })
    const lost = await auditImages(source, { localExists: () => false })
    expect(lost.keywords).toEqual({ checked: 1, missing: 1, keys: ['/assets/game-ui/keywords/tiantui-star.webp'] })
  })

  it('REQ-DATA-SYNC-042 reports every missing count but only the first N keys', async () => {
    const skills = Array.from({ length: 30 }, (_, i) => skill(`s${i}`, `10412${String(i).padStart(2, '0')}`))
    const { source } = fakeSource({ identities: [RYOSHU], skills }, {})
    const result = await auditImages(source, { limit: 5 })
    expect(result.skills.missing).toBe(30)
    expect(result.skills.keys).toHaveLength(5)
    expect((await auditImages(source)).skills.keys).toHaveLength(20)
  })

  it('REQ-DATA-SYNC-042 an empty database reports zero for every kind', async () => {
    const { source } = fakeSource({}, {})
    const result = await auditImages(source)
    for (const kind of IMAGE_AUDIT_KINDS) expect(result[kind]).toEqual({ checked: 0, missing: 0, keys: [] })
  })

  it('REQ-DATA-SYNC-042 prints a line per kind with its missing count and keys', async () => {
    const { source } = fakeSource(TABLES, FOLDERS)
    const lines = formatMissingImages(await auditImages(source))
    expect(lines).toHaveLength(IMAGE_AUDIT_KINDS.length)
    expect(lines[0]).toBe('keywords: 2 of 4 missing: icons/keywords/ashen-bullet.webp, icons/keywords/gaze-of-the-contempt.webp')
    expect(lines[4]).toBe('events: all 1 present')
  })
})

describe('REQ-DATA-SYNC-042 the audit never stops an apply', () => {
  it('REQ-DATA-SYNC-042 a read failure becomes an error note, not an exception', async () => {
    const source: AuditSource = { rows: async () => { throw Error('keyword_meta: boom') }, list: async () => new Set() }
    expect(await auditImagesSafely(source)).toEqual({ error: 'keyword_meta: boom' })
  })

  it('REQ-DATA-SYNC-042 returns the result when reading works', async () => {
    const { source } = fakeSource(TABLES, FOLDERS)
    expect(await auditImagesSafely(source)).toMatchObject({ skills: { missing: 1 } })
  })
})

describe('REQ-DATA-SYNC-042 the Supabase source', () => {
  it('REQ-DATA-SYNC-042 reads every page of a table in key order and every page of a Storage folder, read-only', async () => {
    const calls: string[] = []
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: i }))
    const client = {
      schema: (name: string) => ({
        from: (table: string) => ({
          select: (columns: string) => {
            calls.push(`select ${name}.${table} ${columns}`)
            const query = { order: (column: string) => { calls.push(`order ${column}`); return query }, range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }) }
            return query
          },
        }),
      }),
      storage: { from: () => ({ list: async (dir: string, { limit, offset }: { limit: number; offset: number }) => ({ data: Array.from({ length: Math.max(0, Math.min(limit, 1200 - offset)) }, (_, i) => ({ name: `${dir}-${offset + i}.webp` })), error: null }) }) },
    }
    const source = supabaseAuditSource(client as never)
    expect(await source.rows('keyword_meta', 'name,icon_slug')).toHaveLength(1500)
    expect(calls).toContain('select limbus.keyword_meta name,icon_slug')
    expect(calls).toContain('order name')
    expect((await source.list('icons/keywords')).size).toBe(1200)
  })

  it('REQ-DATA-SYNC-042 an error from the database or Storage names the table or folder', async () => {
    const failing = {
      schema: () => ({ from: () => ({ select: () => { const query = { order: () => query, range: async () => ({ data: null, error: { message: 'denied' } }) }; return query } }) }),
      storage: { from: () => ({ list: async () => ({ data: null, error: { message: 'gone' } }) }) },
    }
    const source = supabaseAuditSource(failing as never)
    await expect(source.rows('skills', 'id')).rejects.toThrow('skills: denied')
    await expect(source.list('icons/events')).rejects.toThrow('Storage icons/events: gone')
  })
})
