#!/usr/bin/env node
// 스키마 설명 JSON에서 Supabase 공식 `gen types`와 같은 모양의 TypeScript 타입 파일을 만든다.
// 공식 도구(MCP generate_typescript_types)는 public 스키마만 주기 때문에 limbus 스키마용으로 직접 만든다.
// 공식 출력과 다른 점: 함수 인자는 모두 `| null`을 허용한다(호출하는 쪽이 일부러 null을 넘긴다).
//   1. scripts/db/schema-snapshot.sql 을 Supabase SQL 편집기나 MCP execute_sql에서 실행한다(SELECT만 쓴다).
//   2. 결과의 `snapshot` 값(JSON)을 파일로 저장한다. 이 JSON은 저장소에 넣지 않는다.
//   3. node scripts/db/gen-types.mjs <스냅샷.json> > lib/supabase/database.types.ts
// 표준 라이브러리만 쓴다. 같은 스냅샷이면 항상 같은 글자가 나온다(표·열·함수는 이름순).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HEADER =
  '// 생성된 파일이다. 손으로 고치지 않는다. 다시 만드는 법: scripts/db/gen-types.mjs 머리 주석.'

const JSON_TYPE = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]`

const NUMBER = ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid']
const STRING = [
  'text', 'varchar', 'bpchar', 'char', 'name', 'citext', 'uuid', 'date', 'time', 'timetz', 'timestamp',
  'timestamptz', 'interval', 'bytea', 'vector', 'inet', 'cidr', 'macaddr', 'xml', 'money', 'tsvector',
]

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
const sorted = (list) => [...(list ?? [])].sort(byName)
const key = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name))
const ref = (schema, section, name) => `Database[${JSON.stringify(schema)}][${JSON.stringify(section)}][${JSON.stringify(name)}]`

// 열·인자·반환 값의 타입 하나를 TypeScript 글자로 바꾼다. 배열 접미사 `[]`까지 붙인다.
function typeOf(col, ctx) {
  let name = col.type
  let array = Boolean(col.array)
  if (!array && col.kind === 'b' && name.startsWith('_')) {
    array = true
    name = name.slice(1)
  }
  const base = baseType({ ...col, type: name }, ctx)
  return array ? `${base}[]` : base
}

function baseType(col, ctx) {
  const { type, kind, typeSchema } = col
  if (kind === 'e') return typeSchema === ctx.schema ? ref(ctx.schema, 'Enums', type) : 'string'
  if (kind === 'c') {
    if (typeSchema !== ctx.schema) return 'unknown'
    if (ctx.composites.has(type)) return ref(ctx.schema, 'CompositeTypes', type)
    if (ctx.tables.has(type)) return `${ref(ctx.schema, 'Tables', type)}["Row"]`
    if (ctx.views.has(type)) return `${ref(ctx.schema, 'Views', type)}["Row"]`
    return 'unknown'
  }
  if (NUMBER.includes(type)) return 'number'
  if (type === 'bool') return 'boolean'
  if (type === 'json' || type === 'jsonb') return 'Json'
  if (STRING.includes(type)) return 'string'
  return 'unknown'
}

const block = (lines, indent) => lines.map((line) => `${' '.repeat(indent)}${line}`).join('\n')

function tableBlock(table, fks, ctx) {
  const cols = sorted(table.columns)
  const row = []
  const insert = []
  const update = []
  for (const col of cols) {
    const type = typeOf(col, ctx)
    const nullable = col.nullable ? ' | null' : ''
    const k = key(col.name)
    row.push(`${k}: ${type}${nullable}`)
    if (col.generated) {
      insert.push(`${k}?: never`)
      update.push(`${k}?: never`)
      continue
    }
    const optional = col.nullable || col.hasDefault || col.identity
    insert.push(`${k}${optional ? '?' : ''}: ${type}${nullable}`)
    update.push(`${k}?: ${type}${nullable}`)
  }
  const rels = fks
    .filter((fk) => fk.table === table.name)
    .sort(byName)
    .map((fk) =>
      block(
        [
          '{',
          `  foreignKeyName: ${JSON.stringify(fk.name)}`,
          `  columns: ${JSON.stringify(fk.columns)}`,
          `  isOneToOne: ${Boolean(fk.isOneToOne)}`,
          `  referencedRelation: ${JSON.stringify(fk.refTable)}`,
          `  referencedColumns: ${JSON.stringify(fk.refColumns)}`,
          '},',
        ],
        10,
      ),
    )
  return [
    `      ${key(table.name)}: {`,
    `        Row: {\n${block(row, 10)}\n        }`,
    `        Insert: {\n${block(insert, 10)}\n        }`,
    `        Update: {\n${block(update, 10)}\n        }`,
    rels.length ? `        Relationships: [\n${rels.join('\n')}\n        ]` : '        Relationships: []',
    '      }',
  ].join('\n')
}

function viewBlock(view, ctx) {
  // 뷰의 열은 PostgreSQL이 널 가능 여부를 알려 주지 않으므로 공식 생성기처럼 모두 `| null`로 둔다.
  const row = sorted(view.columns).map((col) => `${key(col.name)}: ${typeOf(col, ctx)} | null`)
  return [
    `      ${key(view.name)}: {`,
    `        Row: {\n${block(row, 10)}\n        }`,
    '        Relationships: []',
    '      }',
  ].join('\n')
}

// 한 함수(이름이 같은 것이 여럿이면 중복 정의마다 하나씩)의 Args·Returns.
function overload(fn, ctx) {
  // Every argument takes `| null`: PostgREST passes a JSON null as SQL NULL whatever the function declares (the snapshot
  // does not say which functions are STRICT), and the callers pass null on purpose for "no filter".
  const args = (fn.args ?? []).map((arg, i) => `${key(arg.name ?? `arg${i + 1}`)}${arg.hasDefault ? '?' : ''}: ${typeOf(arg, ctx)} | null`)
  return { args, returns: returnsOf(fn, ctx) }
}

function returnsOf(fn, ctx) {
  if (fn.outs?.length) {
    const fields = fn.outs.map((col) => `${key(col.name)}: ${typeOf(col, ctx)}`)
    const shape = `{\n${block(fields, 10)}\n        }`
    return fn.retset ? `${shape}[]` : shape
  }
  const ret = fn.returns
  if (ret.kind === 'p') {
    if (ret.type === 'void') return 'undefined'
    return fn.retset ? 'unknown[]' : 'unknown'
  }
  const type = ret.kind === 'c' && ret.relname && ret.relkind !== 'c' ? { ...ret, type: ret.relname } : ret
  const expr = typeOf(type, ctx)
  return fn.retset && !ret.array ? `${expr}[]` : expr
}

function functionBlock(name, fns, ctx) {
  const parts = fns.map((fn) => overload(fn, ctx))
  const one = (part, indent) => {
    const args = part.args.length ? `{\n${block(part.args, indent + 4)}\n${' '.repeat(indent + 2)}}` : 'Record<PropertyKey, never>'
    return [`${' '.repeat(indent + 2)}Args: ${args}`, `${' '.repeat(indent + 2)}Returns: ${part.returns}`].join('\n')
  }
  if (parts.length === 1) return `      ${key(name)}: {\n${one(parts[0], 6)}\n      }`
  const variants = parts.map((part) => `        | {\n${one(part, 10)}\n          }`)
  return `      ${key(name)}:\n${variants.join('\n')}`
}

function section(title, entries) {
  if (!entries.length) return `    ${title}: {\n      [_ in never]: never\n    }`
  return `    ${title}: {\n${entries.join('\n')}\n    }`
}

export function generateTypes(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.schema !== 'string') {
    throw new Error('스냅샷에 schema(문자열)가 없다.')
  }
  const schema = snapshot.schema
  const tables = sorted(snapshot.tables)
  const views = sorted(snapshot.views)
  const composites = sorted(snapshot.compositeTypes)
  const enums = sorted(snapshot.enums)
  const ctx = {
    schema,
    tables: new Set(tables.map((t) => t.name)),
    views: new Set(views.map((v) => v.name)),
    composites: new Set(composites.map((c) => c.name)),
  }
  const fks = snapshot.foreignKeys ?? []

  // 트리거 함수는 직접 부르는 함수가 아니므로 공식 생성기처럼 뺀다.
  const callable = (snapshot.functions ?? []).filter((fn) => !(fn.returns?.kind === 'p' && fn.returns.type === 'trigger'))
  const grouped = new Map()
  for (const fn of callable) grouped.set(fn.name, [...(grouped.get(fn.name) ?? []), fn])
  const fnNames = [...grouped.keys()].sort()

  const compositeEntries = composites.map((c) => {
    const fields = sorted(c.columns).map((col) => `${key(col.name)}: ${typeOf(col, ctx)}`)
    return `      ${key(c.name)}: {\n${block(fields, 8)}\n      }`
  })
  const enumEntries = enums.map((e) => `      ${key(e.name)}: ${e.values.map((v) => JSON.stringify(v)).join(' | ')}`)

  const database = [
    'export type Database = {',
    `  ${key(schema)}: {`,
    section('Tables', tables.map((t) => tableBlock(t, fks, ctx))),
    section('Views', views.map((v) => viewBlock(v, ctx))),
    section('Functions', fnNames.map((name) => functionBlock(name, grouped.get(name), ctx))),
    section('Enums', enumEntries),
    section('CompositeTypes', compositeEntries),
    '  }',
    '}',
  ].join('\n')

  const enumConstants = enums.length
    ? `    Enums: {\n${enums.map((e) => `      ${key(e.name)}: [${e.values.map((v) => JSON.stringify(v)).join(', ')}],`).join('\n')}\n    },`
    : '    Enums: {},'
  const schemaKey = JSON.stringify(schema)
  const helpers = `type DefaultSchema = Database[${schemaKey}]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]

export type CompositeTypes<T extends keyof DefaultSchema["CompositeTypes"]> =
  DefaultSchema["CompositeTypes"][T]

export const Constants = {
  ${key(schema)}: {
${enumConstants}
  },
} as const`

  return `${HEADER}\n\n${JSON_TYPE}\n\n${database}\n\n${helpers}\n`
}

function main(argv) {
  const [file] = argv
  if (!file) {
    process.stderr.write('사용법: node scripts/db/gen-types.mjs <스냅샷.json> > lib/supabase/database.types.ts\n')
    process.exit(1)
  }
  process.stdout.write(generateTypes(JSON.parse(readFileSync(file, 'utf8'))))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2))
