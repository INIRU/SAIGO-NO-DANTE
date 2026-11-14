import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateTypes } from '../../../scripts/db/gen-types.mjs'

// 가짜 스냅샷. 열 모양은 scripts/db/schema-snapshot.sql 이 돌려주는 모양과 같다.
const snapshot = {
  schema: 'demo',
  tables: [
    {
      name: 'widgets',
      columns: [
        { name: 'id', type: 'uuid', kind: 'b', hasDefault: true },
        { name: 'seq', type: 'int8', kind: 'b', identity: 'byDefault' },
        { name: 'always_seq', type: 'int4', kind: 'b', identity: 'always' },
        { name: 'label', type: 'text', kind: 'b' },
        { name: 'note', type: 'varchar', kind: 'b', nullable: true },
        { name: 'ratio', type: 'numeric', kind: 'b', nullable: true, hasDefault: true },
        { name: 'flag', type: 'bool', kind: 'b', hasDefault: true },
        { name: 'meta', type: 'jsonb', kind: 'b', nullable: true },
        { name: 'tags', type: 'text', kind: 'b', array: true, nullable: true },
        { name: 'ids', type: '_int4', kind: 'b', nullable: true },
        { name: 'status', type: 'widget_status', kind: 'e', typeSchema: 'demo' },
        { name: 'statuses', type: 'widget_status', kind: 'e', typeSchema: 'demo', array: true, nullable: true },
        { name: 'embedding', type: 'vector', kind: 'b', typeSchema: 'extensions', nullable: true },
        { name: 'shape', type: 'weird_thing', kind: 'b', nullable: true },
        { name: 'full name', type: 'text', kind: 'b', nullable: true },
        { name: 'area', type: 'float8', kind: 'b', generated: true, nullable: true },
        { name: 'created_at', type: 'timestamptz', kind: 'b', hasDefault: true },
      ],
    },
    {
      name: 'parts',
      columns: [
        { name: 'id', type: 'int4', kind: 'b', hasDefault: true },
        { name: 'widget_id', type: 'uuid', kind: 'b' },
        { name: 'profile_id', type: 'uuid', kind: 'b', nullable: true },
      ],
    },
  ],
  views: [
    {
      name: 'widget_labels',
      columns: [
        { name: 'id', type: 'uuid', kind: 'b' },
        { name: 'label', type: 'text', kind: 'b', nullable: true },
      ],
    },
  ],
  compositeTypes: [{ name: 'pair', columns: [{ name: 'left', type: 'int4', kind: 'b' }] }],
  foreignKeys: [
    {
      name: 'parts_widget_id_fkey',
      table: 'parts',
      columns: ['widget_id'],
      refSchema: 'demo',
      refTable: 'widgets',
      refColumns: ['id'],
      isOneToOne: false,
    },
    {
      name: 'parts_profile_id_fkey',
      table: 'parts',
      columns: ['profile_id'],
      refSchema: 'demo',
      refTable: 'profiles',
      refColumns: ['id'],
      isOneToOne: true,
    },
  ],
  enums: [{ name: 'widget_status', values: ['open', 'closed'] }],
  functions: [
    {
      name: 'add_one',
      retset: false,
      args: [
        { name: 'n', type: 'int4', kind: 'b' },
        { name: 'step', type: 'int4', kind: 'b', hasDefault: true },
        { name: 'names', type: 'text', kind: 'b', array: true },
        { name: 'state', type: 'widget_status', kind: 'e', typeSchema: 'demo' },
      ],
      returns: { type: 'int8', kind: 'b' },
      outs: null,
    },
    { name: 'ping', retset: false, args: [], returns: { type: 'void', kind: 'p', typeSchema: 'pg_catalog' }, outs: null },
    { name: 'summary', retset: false, args: [{ name: 'p_id', type: 'uuid', kind: 'b' }], returns: { type: 'jsonb', kind: 'b' }, outs: null },
    {
      name: 'list_rows',
      retset: true,
      args: [{ name: 'since', type: 'date', kind: 'b', hasDefault: true }],
      returns: { type: 'record', kind: 'p', typeSchema: 'pg_catalog' },
      outs: [
        { name: 'kind', type: 'text', kind: 'b' },
        { name: 'visitors', type: 'int8', kind: 'b' },
      ],
    },
    {
      name: 'all_widgets',
      retset: true,
      args: [],
      returns: { type: 'widgets', kind: 'c', typeSchema: 'demo', relname: 'widgets', relkind: 'r' },
      outs: null,
    },
    { name: 'touch', retset: false, args: [], returns: { type: 'trigger', kind: 'p', typeSchema: 'pg_catalog' }, outs: null },
  ],
}

const out = generateTypes(snapshot)
// 표는 이름순이라 parts가 앞이다. widgets 표 조각만 잘라 쓴다.
const widgets = out.slice(out.indexOf('      widgets: {'), out.indexOf('    Views: {'))
const between = (from: string, to: string) => widgets.slice(widgets.indexOf(from), widgets.indexOf(to))

describe('generateTypes', () => {
  it('writes the Json type, the schema keys and the empty sections in the official shape', () => {
    expect(out).toContain('export type Json =\n  | string\n  | number\n  | boolean\n  | null\n  | { [key: string]: Json | undefined }\n  | Json[]')
    expect(out).toContain('export type Database = {\n  demo: {\n    Tables: {')
    expect(out).toContain('    CompositeTypes: {\n      pair: {\n        left: number\n      }\n    }')
    expect(out.startsWith('//')).toBe(true)
  })

  it('writes Row with `| null` for nullable columns and sorts columns by name', () => {
    const row = between('        Row: {', '        Insert: {')
    expect(row).toContain('          note: string | null\n')
    expect(row).toContain('          label: string\n')
    expect(row).toContain('          id: string\n')
    expect(row.indexOf('always_seq')).toBeLessThan(row.indexOf('area'))
    expect(row.indexOf('area')).toBeLessThan(row.indexOf('created_at'))
  })

  it('makes Insert fields optional when they are nullable, have a default or are identity; required otherwise', () => {
    const insert = between('        Insert: {', '        Update: {')
    expect(insert).toContain('          id?: string\n')
    expect(insert).toContain('          seq?: number\n')
    expect(insert).toContain('          always_seq?: number\n')
    expect(insert).toContain('          note?: string | null\n')
    expect(insert).toContain('          ratio?: number | null\n')
    expect(insert).toContain('          flag?: boolean\n')
    expect(insert).toContain('          label: string\n')
    expect(insert).toContain('          status: Database["demo"]["Enums"]["widget_status"]\n')
  })

  it('makes every Update field optional', () => {
    const update = between('        Update: {', '        Relationships: [')
    expect(update).toContain('          label?: string\n')
    expect(update).toContain('          status?: Database["demo"]["Enums"]["widget_status"]\n')
    expect(update).not.toMatch(/^ {10}\w+: /m)
  })

  it('keeps generated columns out of Insert and Update', () => {
    const insert = between('        Insert: {', '        Update: {')
    expect(insert).toContain('          area?: never\n')
    expect(out).toContain('          area: number | null\n')
  })

  it('maps Postgres types like the official generator', () => {
    expect(out).toContain('          ratio: number | null\n')
    expect(out).toContain('          seq: number\n')
    expect(out).toContain('          meta: Json | null\n')
    expect(out).toContain('          tags: string[] | null\n')
    expect(out).toContain('          ids: number[] | null\n')
    expect(out).toContain('          statuses: Database["demo"]["Enums"]["widget_status"][] | null\n')
    expect(out).toContain('          embedding: string | null\n')
    expect(out).toContain('          shape: unknown | null\n')
    expect(out).toContain('          created_at: string\n')
  })

  it('quotes keys that are not plain identifiers', () => {
    expect(out).toContain('          "full name": string | null\n')
  })

  it('writes Enums and the Constants mirror', () => {
    expect(out).toContain('    Enums: {\n      widget_status: "open" | "closed"\n    }')
    expect(out).toContain('export const Constants = {\n  demo: {\n    Enums: {\n      widget_status: ["open", "closed"],\n    },\n  },\n} as const')
  })

  it('writes relationships from foreign keys, sorted by name, with isOneToOne', () => {
    const rels = out.slice(out.indexOf('      parts: {'), out.indexOf('    Views: {'))
    expect(rels).toContain(
      [
        '        Relationships: [',
        '          {',
        '            foreignKeyName: "parts_profile_id_fkey"',
        '            columns: ["profile_id"]',
        '            isOneToOne: true',
        '            referencedRelation: "profiles"',
        '            referencedColumns: ["id"]',
        '          },',
        '          {',
        '            foreignKeyName: "parts_widget_id_fkey"',
        '            columns: ["widget_id"]',
        '            isOneToOne: false',
        '            referencedRelation: "widgets"',
        '            referencedColumns: ["id"]',
        '          },',
        '        ]',
      ].join('\n'),
    )
    expect(out).toContain('        Relationships: []')
  })

  it('writes views with a read-only Row where every column is nullable', () => {
    const views = out.slice(out.indexOf('    Views: {'), out.indexOf('    Functions: {'))
    expect(views).toContain('      widget_labels: {\n        Row: {\n          id: string | null\n          label: string | null\n        }\n        Relationships: []\n      }')
    expect(views).not.toContain('Insert')
  })

  it('writes functions: optional args for defaults, Record for no args, void as undefined, set results as arrays', () => {
    const fns = out.slice(out.indexOf('    Functions: {'), out.indexOf('    Enums: {'))
    expect(fns).toContain(
      [
        '      add_one: {',
        '        Args: {',
        '          n: number',
        '          step?: number',
        '          names: string[]',
        '          state: Database["demo"]["Enums"]["widget_status"]',
        '        }',
        '        Returns: number',
        '      }',
      ].join('\n'),
    )
    expect(fns).toContain('      ping: {\n        Args: Record<PropertyKey, never>\n        Returns: undefined\n      }')
    expect(fns).toContain('        Returns: Json\n')
    expect(fns).toContain('        Returns: {\n          kind: string\n          visitors: number\n        }[]\n')
    expect(fns).toContain('        Returns: Database["demo"]["Tables"]["widgets"]["Row"][]\n')
  })

  it('leaves trigger functions out', () => {
    expect(out).not.toContain('touch')
  })

  it('writes empty sections as `[_ in never]: never`', () => {
    const empty = generateTypes({ schema: 'demo', tables: [], views: [], compositeTypes: [], foreignKeys: [], enums: [], functions: [] })
    expect(empty).toContain('    Tables: {\n      [_ in never]: never\n    }')
    expect(empty).toContain('    Enums: {\n      [_ in never]: never\n    }')
    expect(empty).toContain('export const Constants = {\n  demo: {\n    Enums: {},\n  },\n} as const')
  })

  it('is deterministic whatever order the snapshot lists tables in', () => {
    const reversed = { ...snapshot, tables: [...snapshot.tables].reverse(), foreignKeys: [...snapshot.foreignKeys].reverse() }
    expect(generateTypes(reversed)).toBe(out)
  })

  it('throws on a snapshot that is not an object with a schema', () => {
    expect(() => generateTypes({ tables: [] })).toThrow(/schema/)
  })
})

describe('gen-types CLI', () => {
  it('reads a snapshot file and prints the types to stdout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-types-'))
    try {
      const file = join(dir, 'snapshot.json')
      writeFileSync(file, JSON.stringify(snapshot))
      const run = spawnSync(process.execPath, ['scripts/db/gen-types.mjs', file], { encoding: 'utf8' })
      expect(run.status).toBe(0)
      expect(run.stdout).toBe(out)
      const missing = spawnSync(process.execPath, ['scripts/db/gen-types.mjs'], { encoding: 'utf8' })
      expect(missing.status).not.toBe(0)
      expect(missing.stderr).toContain('gen-types.mjs')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
