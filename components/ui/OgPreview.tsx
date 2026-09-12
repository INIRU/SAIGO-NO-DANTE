import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ImageResponse } from 'next/og'
import { getSinnerProfileUrl } from '@/lib/utils/images'
import { clampText, fetchImageDataUri, localizedSiteLabels, OG_SIZE, ogFontOptions } from '@/lib/utils/og-image'

type PreviewProps = {
  lang: 'ko' | 'en' | 'ja'
  eyebrow: string
  title: string
  subtitle?: string
  images?: string[]
  layout?: 'portrait' | 'collage' | 'formation'
}

// One template keeps every share card aligned with the same site typography.
export async function renderOgPreview({ lang, eyebrow, title, subtitle, images = [], layout = 'portrait' }: PreviewProps) {
  const cols = layout === 'formation' ? 6 : layout === 'collage' ? 3 : 1
  const width = layout === 'portrait' ? 510 : Math.floor((510 - (cols - 1) * 6) / Math.max(1, cols))
  const height = layout === 'formation' ? 156 : layout === 'collage' ? 202 : 414
  const [logo, ...art] = await Promise.all([
    sharp(readFileSync(join(process.cwd(), 'public/images/logo.webp'))).resize(36, 48, { fit: 'inside' }).png().toBuffer().then(data => `data:image/png;base64,${data.toString('base64')}`),
    ...images.slice(0, 12).map(url => fetchImageDataUri(url, { width, height, fit: 'cover', format: 'png', position: 'top' })),
  ])
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0d0b08', color: '#eee5d2', padding: '44px 56px', fontFamily: 'Pretendard' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#d3a11c', fontFamily: 'Paperlogy', fontSize: 27 }}>
        <img src={logo} width={36} height={48} alt="" />
        {lang === 'ko' ? '최애의 관리자' : 'SAIGO NO DANTE'}
      </div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 530, flexShrink: 0 }}>
          <div style={{ display: 'flex', color: '#d3a11c', fontSize: 17, letterSpacing: 4, marginBottom: 22 }}>{eyebrow}</div>
          <div style={{ display: 'flex', fontFamily: 'Paperlogy', fontSize: title.length > 35 ? 43 : 56, lineHeight: 1.25, letterSpacing: -1.5, overflowWrap: 'anywhere' }}>{clampText(title, 72)}</div>
          {subtitle && <div style={{ display: 'flex', color: '#a69d8c', fontSize: 23, lineHeight: 1.5, marginTop: 22 }}>{clampText(subtitle, 88)}</div>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 6, width: 510, overflow: 'hidden', borderRadius: 8 }}>
          {art.map((src, index) => src ? <img key={index} src={src} width={width} height={height} alt="" style={{ objectFit: 'cover' }} /> : null)}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8c8066', fontSize: 14, letterSpacing: 2 }}><span>LIMBUS COMPANY FAN ARCHIVE</span><span>SAIGO NO DANTE</span></div>
    </div>,
    { ...OG_SIZE, ...ogFontOptions },
  )
}

export function renderSiteOg(lang: PreviewProps['lang']) {
  return renderOgPreview({
    lang, eyebrow: 'SAIGO NO DANTE',
    title: lang === 'ko' ? '림버스 컴퍼니 팬 아카이브' : lang === 'ja' ? 'Limbus Company ファンアーカイブ' : 'Limbus Company fan archive',
    subtitle: localizedSiteLabels(lang).subtitle,
    images: ['yi-sang', 'ryoshu', 'hong-lu', 'faust', 'sinclair', 'heathcliff'].map(getSinnerProfileUrl), layout: 'collage',
  })
}
