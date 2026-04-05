#!/usr/bin/env node
/**
 * 범용 스토리 데이터 처리
 * 게임 JSON (스크립트 + 한국어 텍스트) → public/data/story/{slug}/ 로 병합 출력
 *
 * Usage:
 *   node scripts/process-story-data.mjs --chapter 100   # 프롤로그
 *   node scripts/process-story-data.mjs --chapter 101   # 1장
 *   node scripts/process-story-data.mjs --chapter 102   # 2장
 *   node scripts/process-story-data.mjs --all            # 전체
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const JSON_DIR = path.join(process.env.HOME, 'Documents/Limbus/assets/data/Json-2')

/* ── Chapter config ──────────────────────────── */

const CHAPTERS = {
  100: { slug: 'prologue', nodeFile: 'KR_StageNode1-0.json', theaterFile: 'storytheater-main-100.json' },
  101: { slug: 'canto-1', nodeFile: 'KR_StageNode1-1.json', theaterFile: 'storytheater-main-101.json' },
  102: { slug: 'canto-2', nodeFile: 'KR_StageNode1-2.json', theaterFile: 'storytheater-main-102.json' },
  103: { slug: 'canto-3', nodeFile: 'KR_StageNode1-3.json', theaterFile: 'storytheater-main-103.json' },
  104: { slug: 'canto-4', nodeFile: 'KR_StageNode1-4.json', theaterFile: 'storytheater-main-104.json' },
}

/* ── Parser ───────────────────────────────────── */

const SCREEN_NAMES = new Set(['black', 'BlackScreen', 'blackbg'])

function parseCG(str) {
  if (!str) return []
  return str
    .split(',')
    .map((p) => {
      const t = p.trim()
      if (!t) return null
      const ci = t.indexOf(':')
      if (ci === -1) return { name: t, action: null }
      const name = t.slice(0, ci).trim()
      const rest = t.slice(ci + 1)
      const am = rest.match(/^(FadeIn|FadeOut)/)
      return { name, action: am ? am[1] : null }
    })
    .filter(Boolean)
}

function parseEffect(str) {
  if (!str) return null
  if (str === 'CamShake') return { type: 'shake', intensity: 5 }
  const m = str.match(/CustomCamShake:\[(\d+)\]/)
  if (m) return { type: 'shake', intensity: parseInt(m[1]) }
  if (str === 'FadeOut') return { type: 'fadeOut' }
  return null
}

/* ── Episode Processing ──────────────────────── */

async function processEpisode(storyId) {
  const scriptPath = path.join(JSON_DIR, `${storyId}.json`)
  const textPath = path.join(JSON_DIR, 'KR', `KR_${storyId}.json`)

  if (!existsSync(scriptPath) || !existsSync(textPath)) {
    throw new Error(`missing ${existsSync(scriptPath) ? textPath : scriptPath}`)
  }

  const script = JSON.parse(await readFile(scriptPath, 'utf-8'))
  const text = JSON.parse(await readFile(textPath, 'utf-8'))

  const textMap = new Map(text.dataList.map((i) => [i.id ?? i.d, i]))
  const lines = []
  let cgStack = []

  for (const item of script.dataList) {
    const itemId = item.id ?? item.d
    if (itemId < 0) continue

    const t = textMap.get(itemId)
    const cgs = parseCG(item.cg)
    const effect = parseEffect(item.effect)

    const prevLen = cgStack.length
    for (const c of cgs) {
      if (c.action === 'FadeIn' && !SCREEN_NAMES.has(c.name) && c.name !== 'ALL') {
        if (!cgStack.includes(c.name)) cgStack.push(c.name)
      }
      if (c.name === 'ALL' && c.action === 'FadeOut') {
        cgStack = []
      }
      if (c.action === 'FadeOut' && c.name !== 'ALL' && !SCREEN_NAMES.has(c.name)) {
        cgStack = cgStack.filter((n) => n !== c.name)
      }
    }
    const stackChanged = cgStack.length !== prevLen

    if (!t?.content && !stackChanged && !effect) continue

    lines.push({
      id: itemId,
      teller: t?.teller ?? t?.model ?? null,
      title: t?.title ?? null,
      content: t?.content ?? null,
      place: t?.place ?? null,
      activeCGs: [...cgStack],
      effect,
    })
  }

  return lines
}

/* ── Process Chapter ─────────────────────────── */

async function processChapter(chapterId) {
  const config = CHAPTERS[chapterId]
  if (!config) {
    console.error(`Unknown chapter: ${chapterId}. Available: ${Object.keys(CHAPTERS).join(', ')}`)
    return
  }

  const outDir = path.join(process.cwd(), 'public', 'data', 'story', config.slug)
  await mkdir(outDir, { recursive: true })

  const theater = JSON.parse(
    await readFile(path.join(JSON_DIR, config.theaterFile), 'utf-8'),
  )

  // 노드 제목 로드
  let nodeMap = new Map()
  const nodeFilePath = path.join(JSON_DIR, 'KR', config.nodeFile)
  if (existsSync(nodeFilePath)) {
    const nodeText = JSON.parse(await readFile(nodeFilePath, 'utf-8'))
    nodeMap = new Map(nodeText.dataList.map((n) => [typeof n.id === 'string' ? parseInt(n.id) : n.id, n]))
  }

  const chapter = theater.list[0]
  const episodes = []

  console.log(`\n[${config.slug}] Processing ${chapter.storyList.length} episodes...`)

  for (const ep of chapter.storyList) {
    process.stdout.write(`  ${ep.storyId}... `)
    try {
      const lines = await processEpisode(ep.storyId)

      await writeFile(
        path.join(outDir, `${ep.storyId}.json`),
        JSON.stringify({ episodeId: ep.storyId, nodeId: ep.nodeId, stageDetail: ep.stageDetail, lines }, null, 2),
      )

      const node = nodeMap.get(ep.nodeId)
      episodes.push({
        id: ep.id,
        storyId: ep.storyId,
        nodeId: ep.nodeId,
        stageDetail: ep.stageDetail,
        lineCount: lines.length,
        nodeTitle: node?.title ?? null,
        nodeDesc: node?.desc ?? null,
        firstPlace: lines.find((l) => l.place)?.place ?? null,
        firstLine: lines.find((l) => l.content)?.content?.slice(0, 60) ?? null,
      })

      console.log(`${lines.length} lines`)
    } catch (err) {
      console.log(`FAILED — ${err.message}`)
    }
  }

  await writeFile(
    path.join(outDir, 'index.json'),
    JSON.stringify({ chapterId: chapter.chapterId, subChapterId: chapter.subChapterId ?? chapterId, episodes }, null, 2),
  )

  console.log(`  → ${episodes.length} episodes saved to ${outDir}`)
}

/* ── Main ─────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--all')) {
    for (const id of Object.keys(CHAPTERS)) {
      await processChapter(parseInt(id))
    }
  } else if (args.includes('--chapter')) {
    const idx = args.indexOf('--chapter')
    const id = parseInt(args[idx + 1])
    await processChapter(id)
  } else {
    console.log('Usage:')
    console.log('  node scripts/process-story-data.mjs --chapter 100')
    console.log('  node scripts/process-story-data.mjs --all')
    console.log(`\nAvailable chapters: ${Object.entries(CHAPTERS).map(([id, c]) => `${id} (${c.slug})`).join(', ')}`)
  }
}

main().catch(console.error)
