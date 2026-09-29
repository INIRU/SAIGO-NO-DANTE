import localFont from 'next/font/local'
import { pretendardCore, pretendardExt, pretendardHeadingLatin as headingLatin } from './pretendard'

/* ── All fonts are self-hosted; licenses in public/fonts/licenses ── */

// numeric overlay font — loaded on demand outside critical layout text
const excelsiorSans = localFont({
  src: '../public/fonts/ExcelsiorSans.woff2',
  variable: '--font-excelsior',
  display: 'swap',
  preload: false,
})

// visible identity-name font — loaded by IdentityCard measurement when cards render
const mikodacs = localFont({
  src: '../public/fonts/Mikodacs.woff2',
  variable: '--font-mikodacs',
  display: 'swap',
  preload: false,
  fallback: ['Pretendard', 'Segoe UI', 'sans-serif'],
})

// decorative — display:optional prevents FOUT
const bebasKai = localFont({
  src: [
    { path: '../public/fonts/BebasKai.woff2', style: 'normal' },
  ],
  variable: '--font-bebas-kai',
  display: 'optional',
  preload: false,
})

// heading font — keep swap but specify fallback with similar metrics to reduce shift
const kotraBold = localFont({
  src: '../public/fonts/KOTRA_BOLD.woff2',
  weight: '700',
  variable: '--font-kotra-bold',
  display: 'swap',
  preload: true,
  fallback: ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
})

// body font — keep swap (critical for readability) + similar-metric fallbacks
const scDream = localFont({
  src: '../public/fonts/SCDream5.woff2',
  weight: '500',
  variable: '--font-scdream',
  display: 'swap',
  preload: true,
  fallback: ['Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
})

const paperlogy = localFont({
  src: [
    { path: '../public/fonts/Paperlogy-Light.woff2', weight: '300', style: 'normal' },
    { path: '../public/fonts/Paperlogy-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/Paperlogy-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-paperlogy',
  display: 'swap',
  preload: false,
})

// Japanese UI text: M PLUS 1p (OFL), subset to JIS X 0208 + kana + Latin.
// Variable name kept so existing var(--font-noto-jp) callers keep working.
const japaneseSans = localFont({
  src: [
    { path: '../public/fonts/MPLUS1p-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/MPLUS1p-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-noto-jp',
  display: 'swap',
  preload: false,
  fallback: ['Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'sans-serif'],
})

// Japanese identity names: Corporate Logo Bold (OFL, LOGOTYPE.JP), subset to JIS level-1 kanji + kana + card titles.
const corporateLogo = localFont({
  src: '../public/fonts/CorporateLogo-Bold.woff2',
  weight: '700',
  variable: '--font-corporate-logo',
  display: 'swap',
  preload: false,
  fallback: ['Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'sans-serif'],
})

// en/ja bold headings: Pretendard's Latin subset (headingLatin, app/pretendard.ts); M PLUS 1p Bold declared for every weight.
const headingJapanese = localFont({
  src: '../public/fonts/MPLUS1p-Bold.woff2',
  weight: '100 900',
  variable: '--font-heading-jp',
  display: 'swap',
  preload: false,
  fallback: ['Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'sans-serif'],
})

const notoSansMono = localFont({
  src: '../public/fonts/NotoSansMono-Variable.woff2',
  weight: '100 900',
  variable: '--font-noto-sans-mono',
  display: 'swap',
  preload: false,
})

// Pretendard is split by unicode-range (scripts/assets/subset-pretendard.py); globals.css joins core and ext as --font-pretendard.
export const fontVariables = [excelsiorSans, mikodacs, bebasKai, kotraBold, scDream, pretendardCore, pretendardExt, paperlogy, japaneseSans, corporateLogo, headingLatin, headingJapanese, notoSansMono].map(font => font.variable).join(' ')
