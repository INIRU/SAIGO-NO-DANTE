import { Black_Han_Sans, Song_Myung, Noto_Sans_JP, Noto_Sans_Mono } from 'next/font/google'
import localFont from 'next/font/local'

// decorative — display:optional prevents FOUT (stays on fallback if not loaded in time)
const songMyung = Song_Myung({
  weight: '400',
  variable: '--font-song-myung',
  display: 'optional',
})

// decorative — display:optional prevents FOUT
const blackHanSans = Black_Han_Sans({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-black-han',
  display: 'optional',
})

/* ── Local Fonts ──────────────────────────────────────── */

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

const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  weight: '45 920',
  style: 'normal',
  variable: '--font-pretendard',
  display: 'swap',
  preload: true,
  fallback: ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
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

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-jp',
  display: 'optional',
  preload: false,
})

const notoSansMono = Noto_Sans_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans-mono',
  display: 'swap',
  preload: false,
})

export const fontVariables = [songMyung, blackHanSans, excelsiorSans, mikodacs, bebasKai, kotraBold, scDream, pretendard, paperlogy, notoSansJP, notoSansMono].map(font => font.variable).join(' ')
