import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ImageResponse } from 'next/og'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { getSinnerProfileUrl } from '@/lib/utils/images'
import { clampText, fetchImageDataUri, formationArt, OG_SIZE, ogFontOptions } from '@/lib/utils/og-image'

type PreviewProps = {
  lang: 'ko' | 'en' | 'ja'
  /** What the page is, in the reader's language: a sinner's name, "덱", "거울 던전 플랜". */
  label?: string
  title: string
  images?: string[]
  /** portrait: one illustration. formation: up to 12 portraits as slanted panels in the game's 6×2 order. Both fill the right side. */
  layout?: 'portrait' | 'formation'
  /** The label's colour (a sinner's own colour on their pages). */
  accent?: string
}

const BG = '#0d0b08'
const ART = { width: 800, height: 630 }

// One template keeps every share card aligned with the same site typography.
export async function renderOgPreview({ lang, label, title, images = [], layout = 'portrait', accent = '#e8b030' }: PreviewProps) {
  const formation = layout === 'formation'
  // The panels keep every slot readable, so they fade less and leave the title its own dark column.
  const box = formation ? { width: 730, height: 630 } : ART
  const column = formation ? 440 : 560
  // A word is never broken, so the longest one sets the ceiling (Latin letters are about half a square wide).
  const longest = Math.max(...title.split(/\s+/).map(word => [...word].reduce((sum, ch) => sum + (ch.charCodeAt(0) < 0x2e80 ? 0.56 : 1), 0)))
  const size = Math.min((title.length > 34 ? 46 : title.length > 16 ? 58 : 72) - (formation ? 12 : 0), Math.floor(column / Math.max(1, longest)))
  const [logo, art] = await Promise.all([
    sharp(readFileSync(join(process.cwd(), 'public/icons/icon.svg'))).resize(40, 40).png().toBuffer().then(data => `data:image/png;base64,${data.toString('base64')}`),
    formation
      ? formationArt(images, box.width, box.height)
      : fetchImageDataUri(images[0] ?? '', { ...ART, fit: 'cover', position: 'attention', quality: 86 }),
  ])
  const display = lang === 'ja' ? 'MPLUS' : 'Paperlogy'
  return new ImageResponse(
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', background: BG, color: '#f1e8d6', fontFamily: 'Pretendard' }}>
      {art && <img src={art} {...box} alt="" style={{ position: 'absolute', top: 0, right: 0 }} />}
      {art && <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', ...box, backgroundImage: formation
        ? `linear-gradient(90deg, ${BG} 0%, rgba(13,11,8,0.5) 7%, rgba(13,11,8,0) 22%)`
        : `linear-gradient(90deg, ${BG} 0%, rgba(13,11,8,0.82) 22%, rgba(13,11,8,0.2) 56%, rgba(13,11,8,0) 100%)` }} />}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', padding: '44px 56px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#e8b030', fontFamily: 'Paperlogy', fontSize: 24 }}>
          <img src={logo} width={40} height={40} alt="" />
          {lang === 'ko' ? '최애의 관리자' : 'SAIGO NO DANTE'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: column }}>
          {label && <div style={{ display: 'flex', color: accent, fontFamily: display, fontSize: 28, marginBottom: 14, textShadow: `0 2px 14px ${BG}` }}>{clampText(label, 40)}</div>}
          <div style={{ display: 'flex', fontFamily: display, fontSize: Math.max(lang === 'ja' ? 44 : 30, size), lineHeight: 1.22, letterSpacing: -1.5, wordBreak: lang === 'ja' ? 'normal' : 'keep-all', textShadow: `0 2px 18px ${BG}` }}>{clampText(title, 60)}</div>
        </div>
      </div>
    </div>,
    { ...OG_SIZE, ...ogFontOptions },
  )
}

export function renderSiteOg(lang: PreviewProps['lang']) {
  return renderOgPreview({
    lang, layout: 'formation',
    title: lang === 'ko' ? '림버스 컴퍼니 팬 아카이브' : lang === 'ja' ? 'Limbus Company ファンアーカイブ' : 'Limbus Company fan archive',
    images: SINNER_SLUGS.map(getSinnerProfileUrl),
  })
}
