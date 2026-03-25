#!/usr/bin/env node
/**
 * 프롤로그 스토리 데이터 처리
 * 게임 JSON (스크립트 + 한국어 텍스트) → public/data/story/prologue/ 로 병합 출력
 *
 * Usage: node scripts/process-prologue-data.mjs
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'

const JSON_DIR = path.join(process.env.HOME, 'Downloads/JSON')
const OUT_DIR = path.join(process.cwd(), 'public', 'data', 'story', 'prologue')

/* ── Parser (inline — .mjs can't import .ts) ─── */

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
  const script = JSON.parse(
    await readFile(path.join(JSON_DIR, `${storyId}.json`), 'utf-8'),
  )
  const text = JSON.parse(
    await readFile(path.join(JSON_DIR, 'KR', `KR_${storyId}.json`), 'utf-8'),
  )

  const textMap = new Map(text.dataList.map((i) => [i.id, i]))
  const lines = []
  let cgStack = [] // CG 레이어 스택 (아래→위)

  for (const item of script.dataList) {
    if (item.id < 0) continue

    const t = textMap.get(item.id)
    const cgs = parseCG(item.cg)
    const effect = parseEffect(item.effect)

    const prevLen = cgStack.length
    for (const c of cgs) {
      if (
        c.action === 'FadeIn' &&
        !SCREEN_NAMES.has(c.name) &&
        c.name !== 'ALL'
      ) {
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

    // 텍스트·CG변화·효과 중 하나라도 있어야 포함
    if (!t?.content && !stackChanged && !effect) continue

    lines.push({
      id: item.id,
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

/* ── Main ─────────────────────────────────────── */

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const theater = JSON.parse(
    await readFile(
      path.join(JSON_DIR, 'storytheater-main-100.json'),
      'utf-8',
    ),
  )

  // 노드별 제목/설명 로드
  const nodeText = JSON.parse(
    await readFile(path.join(JSON_DIR, 'KR', 'KR_StageNode1-0.json'), 'utf-8'),
  )
  const nodeMap = new Map(nodeText.dataList.map((n) => [parseInt(n.id), n]))

  const chapter = theater.list[0]
  const episodes = []

  for (const ep of chapter.storyList) {
    process.stdout.write(`${ep.storyId}... `)
    try {
      const lines = await processEpisode(ep.storyId)

      await writeFile(
        path.join(OUT_DIR, `${ep.storyId}.json`),
        JSON.stringify(
          {
            episodeId: ep.storyId,
            nodeId: ep.nodeId,
            stageDetail: ep.stageDetail,
            lines,
          },
          null,
          2,
        ),
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
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(
      { chapterId: 1, subChapterId: 100, episodes },
      null,
      2,
    ),
  )

  console.log(`\nDone! ${episodes.length} episodes → ${OUT_DIR}`)
}

main().catch(console.error)
