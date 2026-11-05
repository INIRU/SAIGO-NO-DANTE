#!/usr/bin/env node
// 파일 옮기기 도구. map(`옛경로 새경로`, 폴더 가능)을 받아 옮긴 파일을 가리키는 모든 경로 글자를 한 번에 바꾼다.
//   node scripts/dev/move-files.mjs <map.txt>           계획만 출력
//   node scripts/dev/move-files.mjs <map.txt> --write   git mv 후 파일을 고쳐 쓴다
// 표준 라이브러리만 쓴다.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'

// 경로 조각: 글자·숫자·_-.@ 또는 [lang] 같은 대괄호 이름. 앞이 경로 글자면 경로의 중간이라 건너뛴다.
// 정규식으로 글자를 훑는다(AST 아님). 조각으로 만드는 경로(path.join('lib', x))와 슬래시 없는 파일 이름은 못 본다.
const SEG = String.raw`(?:[\w\-.@]|\[[\w.\-]+\])+`
const TOKEN = new RegExp(String.raw`(?<![\w\-./@])${SEG}(?:/${SEG})+`, 'g')
// 별칭 확장자 없는 import가 가리킬 수 있는 실제 파일 모양
const SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
// import/export ... from '…', import '…', import('…')
const STATEMENT =
  /\b(?:import|export)\s+(?:type\s+)?([^'";]*?)\s*\bfrom\s*(['"])([^'"\n]+)\2|\bimport\s*(['"])([^'"\n]+)\4|\bimport\(\s*(['"])([^'"\n]+)\6\s*\)/g
const CODE = /\.(?:ts|tsx|mts|mjs|cjs|js)$/

const relativeSpec = (fromDir, target) => {
  const rel = posix.relative(fromDir || '.', target)
  return rel.startsWith('.') ? rel : `./${rel}`
}

/** 옛 경로 p(확장자·/index가 생략됐을 수 있음)가 옮겨지면 새 경로를 같은 표기로 돌려준다. */
function lookup(map, dirs, p, loose) {
  for (const s of loose ? SUFFIXES : ['']) {
    const to = map.get(p + s)
    if (to) return s ? to.replace(/(?:\/index)?\.tsx?$/, '') : to
  }
  return dirs.get(p)
}

/**
 * 바뀐 파일만 돌려준다. 옮겨지는 파일은 옮긴 뒤의 경로(path)로 돌려준다.
 * @param {Array<[string, string]>} renames 파일 단위 [옛 경로, 새 경로]
 * @param {Array<{ path: string, source: string }>} files 검사할 파일(옛 경로 기준)
 * @param {Array<[string, string]>} [dirList] 폴더 단위 [옛, 새]. 문서에 적힌 폴더 이름만 바꾼다.
 * @returns {Array<{ path: string, source: string }>}
 */
export function rewriteSources(renames, files, dirList = []) {
  const map = new Map(renames)
  const dirs = new Map(dirList)
  const result = []
  for (const { path, source } of files) {
    const newPath = map.get(path) ?? path
    const aliasStyle = CODE.test(path)
    const out = source.replace(TOKEN, (tok) => {
      const trail = /\.+$/.exec(tok)?.[0] ?? '' // 문장 끝 마침표
      const body = tok.slice(0, tok.length - trail.length)
      return (rewriteToken(body) ?? body) + trail
    })
    if (out !== source) result.push({ path: newPath, source: out })

    function rewriteToken(body) {
      if (body.startsWith('@/')) {
        const to = lookup(map, dirs, body.slice(2), true)
        return to && `@/${to}`
      }
      if (!body.startsWith('./') && !body.startsWith('../')) return lookup(map, dirs, body, false)
      const abs = posix.join(posix.dirname(path), body)
      if (abs.startsWith('..')) return undefined
      const moved = lookup(map, dirs, abs, true)
      if (!moved && newPath === path) return undefined // 가리키는 쪽도 가리켜지는 쪽도 그대로
      const target = moved ?? abs
      const rel = relativeSpec(posix.dirname(newPath), target)
      if (rel === body) return undefined // 같이 옮겨져서 상대 경로가 그대로 맞음
      return aliasStyle ? `@/${target}` : rel
    }
  }
  return result
}

/**
 * 옮기지 않는 파일 중 옮겨질 파일을 import하는 곳과 가져다 쓰는 이름. 입구(index.ts)에 내보낼 것을 정하는 근거다.
 * 이름: 기본 → 'default', 네임스페이스·동적 import → '*', 부작용 import → 없음.
 * @param {Array<[string, string]>} renames
 * @param {Array<{ path: string, source: string }>} files
 * @returns {Array<{ importer: string, target: string, names: string[] }>}
 */
export function externalImporters(renames, files) {
  const map = new Map(renames)
  const found = new Map()
  for (const { path, source } of files) {
    if (map.has(path)) continue
    for (const m of source.matchAll(STATEMENT)) {
      const spec = m[3] ?? m[5] ?? m[7]
      const abs = spec.startsWith('@/') ? spec.slice(2) : /^\.\.?\//.test(spec) ? posix.join(posix.dirname(path), spec) : null
      const target = abs && SUFFIXES.map((s) => abs + s).find((p) => map.has(p))
      if (!target) continue
      const key = `${path}\0${target}`
      const entry = found.get(key) ?? { importer: path, target, names: [] }
      found.set(key, entry)
      for (const name of m[7] ? ['*'] : importedNames(m[1])) if (!entry.names.includes(name)) entry.names.push(name)
    }
  }
  return [...found.values()].sort((a, b) => (a.target < b.target ? -1 : a.target > b.target ? 1 : a.importer < b.importer ? -1 : 1))
}

function importedNames(clause = '') {
  const names = []
  const braces = /\{([^}]*)\}/.exec(clause)
  if (braces) {
    for (const part of braces[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (name) names.push(name)
    }
  }
  const rest = clause.replace(/\{[^}]*\}/, '').trim()
  if (/\*/.test(rest)) names.push('*')
  const def = /^([\w$]+)\s*,?/.exec(rest)
  if (def) names.unshift('default')
  return names
}

/**
 * map 줄을 파일 단위 [옛, 새] 목록으로 펼친다. 폴더는 추적 중인 그 아래 모든 파일이 된다.
 * @param {string[]} lines `옛경로 새경로`. 빈 줄과 # 줄은 건너뛴다.
 * @param {string[]} tracked git이 추적하는 파일 경로
 * @returns {{ renames: Array<[string, string]>, dirs: Array<[string, string]> }}
 */
export function expandRenames(lines, tracked) {
  const renames = []
  const dirs = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s+/)
    if (parts.length !== 2) throw new Error(`map 줄은 "옛경로 새경로" 두 칸이어야 합니다: ${line}`)
    const from = parts[0].replace(/\/+$/, '')
    const to = parts[1].replace(/\/+$/, '')
    if (tracked.includes(from)) {
      renames.push([from, to])
      continue
    }
    const under = tracked.filter((f) => f.startsWith(`${from}/`))
    if (under.length === 0) throw new Error(`git이 추적하는 파일이 없습니다: ${from}`)
    for (const f of under) renames.push([f, to + f.slice(from.length)])
    dirs.push([from, to])
  }
  return { renames, dirs }
}

// ---- CLI -------------------------------------------------------------------

const SCAN_DIRS = ['app/', 'components/', 'lib/', 'hooks/', 'features/', 'tests/', 'e2e/', 'scripts/', 'docs/']
const ROOT_FILES = /^(?:AGENTS\.md|README\.md|DESIGN\.md|next\.config\.ts|vitest\.config\.ts|proxy\.ts|instrumentation[^/]*\.ts)$/
const SCAN_EXT = /\.(?:ts|tsx|mts|mjs|cjs|js|css|md|json)$/
const NEVER = /^(?:node_modules\/)/

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
const lsFiles = (...args) => git('ls-files', '-z', ...args).split('\0').filter(Boolean)

function main(argv) {
  const mapFile = argv.find((a) => !a.startsWith('--'))
  const write = argv.includes('--write')
  if (!mapFile) {
    console.error('사용법: node scripts/dev/move-files.mjs <map.txt> [--write]\n  map.txt: 한 줄에 "옛경로 새경로" (폴더 가능). --write가 없으면 계획만 출력합니다.')
    return 1
  }
  const tracked = lsFiles()
  const { renames, dirs } = expandRenames(readFileSync(mapFile, 'utf8').split('\n'), tracked)
  const moved = new Set(renames.map(([from]) => from))

  const problems = []
  const targets = new Set()
  for (const [, to] of renames) {
    if (targets.has(to)) problems.push(`새 경로가 겹칩니다: ${to}`)
    targets.add(to)
    if (existsSync(to)) problems.push(`새 경로에 이미 파일이 있습니다: ${to}`)
  }

  const scanned = tracked.filter((f) => !NEVER.test(f) && SCAN_EXT.test(f) && (ROOT_FILES.test(f) || SCAN_DIRS.some((d) => f.startsWith(d)) || moved.has(f)))
  const files = scanned.map((path) => ({ path, source: readFileSync(path, 'utf8') }))
  const changed = rewriteSources(renames, files, dirs)
  const importers = externalImporters(renames, files)

  const oldPathOf = new Map(renames.map(([from, to]) => [to, from]))
  const touched = new Set([...moved, ...changed.map((c) => oldPathOf.get(c.path) ?? c.path)])
  const dirty = git('diff', '--name-only', '-z').split('\0').filter((f) => touched.has(f))
  for (const f of dirty) problems.push(`스테이지하지 않은 변경이 있습니다: ${f}`)

  console.log(`옮길 파일 ${renames.length}개`)
  for (const [from, to] of renames) console.log(`  ${from} -> ${to}`)
  console.log(`\n내용을 고칠 파일 ${changed.length}개`)
  for (const { path } of changed) console.log(`  ${path}`)
  console.log(`\n옮기지 않는 파일이 가져다 쓰는 곳 ${importers.length}건 (입구 후보)`)
  let last = ''
  for (const { importer, target, names } of importers) {
    if (target !== last) console.log(`  ${target}`)
    last = target
    console.log(`    ${importer}  ${names.length ? names.join(', ') : '(부작용 import)'}`)
  }

  if (problems.length) {
    console.error(`\n거부합니다:\n${problems.map((p) => `  ${p}`).join('\n')}`)
    return 1
  }
  if (!write) {
    console.log('\n계획만 출력했습니다. 실제로 옮기려면 --write를 붙이세요.')
    return 0
  }
  for (const [from, to] of renames) {
    mkdirSync(posix.dirname(to), { recursive: true })
    git('mv', from, to)
  }
  for (const { path, source } of changed) writeFileSync(path, source)
  console.log(`\n${renames.length}개를 옮기고 ${changed.length}개를 고쳐 썼습니다.`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2))
