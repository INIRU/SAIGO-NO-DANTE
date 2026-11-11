import { readFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

let pretendardRegular: ArrayBuffer | null = null
try {
  pretendardRegular = toArrayBuffer(readFileSync(join(process.cwd(), 'public', 'fonts', 'Pretendard-Regular.ttf')))
} catch {
  pretendardRegular = null
}

let paperlogyBold: ArrayBuffer | null = null
try {
  paperlogyBold = toArrayBuffer(readFileSync(join(process.cwd(), 'public', 'fonts', 'Paperlogy-Bold.ttf')))
} catch {
  paperlogyBold = null
}

let perfectDos: ArrayBuffer | null = null
try {
  perfectDos = toArrayBuffer(readFileSync(join(process.cwd(), 'public', 'fonts', 'PerfectDOSVGA437.ttf')))
} catch {
  perfectDos = null
}

// Japanese titles: Paperlogy has no kana, and the fallback face is a thin one.
let mplusBold: ArrayBuffer | null = null
try {
  mplusBold = toArrayBuffer(readFileSync(join(process.cwd(), 'public', 'fonts', 'MPLUS1p-Bold.ttf')))
} catch {
  mplusBold = null
}

export const ogFontOptions = {
  fonts: [
    ...(mplusBold
      ? [{ name: 'MPLUS', data: mplusBold, style: 'normal' as const, weight: 700 as const }]
      : []),
    ...(pretendardRegular
      ? [{ name: 'Pretendard', data: pretendardRegular, style: 'normal' as const, weight: 400 as const }]
      : []),
    ...(paperlogyBold
      ? [{ name: 'Paperlogy', data: paperlogyBold, style: 'normal' as const, weight: 700 as const }]
      : []),
    ...(perfectDos
      ? [{ name: 'PerfectDOS', data: perfectDos, style: 'normal' as const, weight: 400 as const }]
      : []),
  ],
}

type ImageDataUriOptions = {
  width: number
  height: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  position?: string
  quality?: number
  format?: 'jpeg' | 'png'
}

export async function fetchImageDataUri(url: string, options: ImageDataUriOptions): Promise<string> {
  if (!url) return ''

  try {
    const response = await fetch(url, { cache: 'force-cache' })
    if (!response.ok) return ''

    const input = Buffer.from(await response.arrayBuffer())
    const pipeline = sharp(input).resize(options.width, options.height, {
      fit: options.fit ?? 'cover',
      position: options.position ?? 'top',
      withoutEnlargement: false,
      background: options.format === 'png' ? { r: 13, g: 11, b: 8, alpha: 0 } : '#0d0b08',
    })

    const output = options.format === 'png'
      ? await pipeline.png({ compressionLevel: 8 }).toBuffer()
      : await pipeline.jpeg({ quality: options.quality ?? 78, mozjpeg: true }).toBuffer()

    const mime = options.format === 'png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${output.toString('base64')}`
  } catch {
    return ''
  }
}

/**
 * Up to 12 portraits in the game's 6×2 formation order as one picture of slanted panels (the game's own panel cut),
 * sized to stand where a single illustration would. An empty slot stays a dark panel.
 */
export async function formationArt(urls: string[], width: number, height: number): Promise<string> {
  const gap = 4, slant = 44, cols = 6
  const cellH = Math.floor((height - gap) / 2)
  const cellW = Math.floor((width - slant) / cols) - gap
  const boxW = cellW + slant
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${cellH}"><polygon points="${slant},0 ${boxW},0 ${cellW},${cellH} 0,${cellH}"/></svg>`)
  const panels = await Promise.all(urls.slice(0, cols * 2).map(async (url, index) => {
    let panel = sharp({ create: { width: boxW, height: cellH, channels: 4, background: '#1a1510' } })
    try {
      const response = url ? await fetch(url, { cache: 'force-cache' }) : null
      if (response?.ok) panel = sharp(Buffer.from(await response.arrayBuffer())).resize(boxW, cellH, { fit: 'cover', position: 'top' })
    } catch { /* the dark panel stands in */ }
    const input = await panel.ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
    const row = Math.floor(index / cols)
    // The lower row sits one slant to the left so the cut runs through both rows as one line.
    return { input, left: (index % cols) * (cellW + gap) + (row ? 0 : slant), top: row * (cellH + gap) }
  }))
  if (!panels.length) return ''
  const output = await sharp({ create: { width: width + slant, height, channels: 4, background: { r: 13, g: 11, b: 8, alpha: 1 } } })
    .composite(panels).extract({ left: 0, top: 0, width, height }).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
  return `data:image/jpeg;base64,${output.toString('base64')}`
}

/** Whole posters side by side, uncropped (theme packs as the game lays them out to choose from). */
export async function posterRowArt(urls: string[], posterWidth: number, posterHeight: number, gap: number): Promise<string> {
  const posters = (await Promise.all(urls.map(async url => {
    try {
      const response = await fetch(url, { cache: 'force-cache' })
      if (!response.ok) return null
      return await sharp(Buffer.from(await response.arrayBuffer())).resize(posterWidth, posterHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    } catch { return null }
  }))).flatMap(poster => poster ? [poster] : [])
  if (!posters.length) return ''
  const output = await sharp({ create: { width: posters.length * (posterWidth + gap) - gap, height: posterHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(posters.map((input, index) => ({ input, left: index * (posterWidth + gap), top: 0 }))).png({ compressionLevel: 8 }).toBuffer()
  return `data:image/png;base64,${output.toString('base64')}`
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}

export function clampText(value: string | null | undefined, maxLength: number): string {
  const text = (value ?? '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

export function isSupportedLang(lang: string): lang is 'ko' | 'en' | 'ja' {
  return lang === 'ko' || lang === 'en' || lang === 'ja'
}

export function localizedSiteLabels(lang: 'ko' | 'en' | 'ja') {
  if (lang === 'en') {
    return {
      alt: 'SAIGO NO DANTE — Limbus Company fan archive',
      eyebrow: 'LIMBUS COMPANY FAN ARCHIVE',
      subtitle: 'Character archive, deck board, Mirror Dungeon records',
      features: ['Sinner DB', 'Deck board', 'Mirror Dungeon', 'Meta archive'],
      locale: 'EN ARCHIVE',
    }
  }

  if (lang === 'ja') {
    return {
      alt: 'SAIGO NO DANTE — Limbus Company ファンアーカイブ',
      eyebrow: 'LIMBUS COMPANY FAN ARCHIVE',
      subtitle: '囚人データベース、デッキ掲示板、鏡ダンジョン記録',
      features: ['囚人DB', 'デッキ掲示板', '鏡ダンジョン', 'メタ記録'],
      locale: 'JA ARCHIVE',
    }
  }

  return {
    alt: '최애의 관리자 — Limbus Company 팬 아카이브',
    eyebrow: 'LIMBUS COMPANY FAN ARCHIVE',
    subtitle: '수감자 데이터베이스, 덱 게시판, 거울 던전 기록',
    features: ['수감자 DB', '덱 게시판', '거울 던전', '메타 기록'],
    locale: 'KO ARCHIVE',
  }
}
