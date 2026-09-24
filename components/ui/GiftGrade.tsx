import type { CSSProperties } from 'react'
import { GRADE_ROMAN } from '@/lib/constants/gift'
import { getGameUiAsset } from '@/lib/utils/game-ui'

// Grades I–V reuse the E.G.O stage numerals (public/assets/ego-stages, 224×192); EX has its own sprite.
// Glyph fill bounds [x0, y0, x1, y1] measured with sharp (alpha ≥ 235, green > 130, i.e. the fill without its glow).
// The canvases crop each numeral differently (II is 5% shorter), so every glyph is scaled to the same cap height.
const GLYPHS: Record<string, { w: number; h: number; box: [number, number, number, number] }> = {
  '1': { w: 224, h: 192, box: [103, 32, 120, 158] },
  '2': { w: 224, h: 192, box: [82, 35, 140, 156] },
  '3': { w: 224, h: 192, box: [61, 32, 162, 159] },
  '4': { w: 224, h: 192, box: [45, 32, 181, 158] },
  '5': { w: 224, h: 192, box: [63, 35, 155, 158] },
  EX: { w: 119, h: 122, box: [17, 17, 101, 104] },
}
const CAP = 0.85 // cap height in em
const GLOW = 0.16 // em of glow drawn around the fill; bleeds outside the box via negative margins

/** Gift grade glyph sized by the parent's font-size: its box is the numeral's fill (cap 0.85em), top-left aligned. `plain` keeps the Roman text. */
export default function GiftGrade({ grade, style, className, plain = false }: {
  grade?: string | null
  style?: CSSProperties
  className?: string
  plain?: boolean
}) {
  const key = grade ?? '1'
  const label = GRADE_ROMAN[key] ?? key
  const glyph = plain ? null : GLYPHS[key]
  if (!glyph) return <span className={className} style={style}>{label}</span>
  const [x0, y0, x1, y1] = glyph.box
  const em = (px: number) => `${(px * CAP) / (y1 - y0 + 1)}em`
  const src = key === 'EX' ? getGameUiAsset('gift/grade-ex') : `/assets/ego-stages/${key}.webp`
  return <span className={className} style={style}>
    <span role="img" aria-label={label} style={{
      display: 'block', boxSizing: 'content-box', margin: `-${GLOW}em`, padding: `${GLOW}em`,
      width: em(x1 - x0 + 1), height: `${CAP}em`,
      backgroundImage: `url(${src})`, backgroundRepeat: 'no-repeat', backgroundOrigin: 'border-box',
      backgroundSize: `${em(glyph.w)} ${em(glyph.h)}`,
      backgroundPosition: `calc(${GLOW}em - ${em(x0)}) calc(${GLOW}em - ${em(y0)})`,
    }} />
  </span>
}
