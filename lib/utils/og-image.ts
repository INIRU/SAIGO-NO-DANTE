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

export const ogFontOptions = {
  fonts: [
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
  fit?: keyof sharp.FitEnum
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
