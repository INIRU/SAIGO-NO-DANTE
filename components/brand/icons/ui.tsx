import { Svg, cut, star, type IconProps } from './Svg'

// Generic glyphs. Pure line drawings; a filled part only where the game's own icon is solid (play, checked boxes).

// 가 and A: the site speaks Korean first.
export const LanguageIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 5.5h6c0 4.2-2 7.2-5.5 8.8M12.5 4v10M12.5 8.8h2.3M14 20.5l3.3-8.5 3.3 8.5M15.2 17.5h4.2" /></Svg>
)

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(4, 5.5, 16, 15, 2)} /><path d="M8.5 3v4.5M15.5 3v4.5M4 10.5h16" /><path d={star(15.2, 15.6, 2.7)} fill="currentColor" stroke="none" /></Svg>
)

export const YoutubeIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(2.5, 5, 19, 14, 3)} /><path d="M10 9v6l5-3Z" fill="currentColor" stroke="none" /></Svg>
)
