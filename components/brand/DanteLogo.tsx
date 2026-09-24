import { useId, type SVGProps } from 'react'

// 단테의 시계 머리. 링·바늘은 currentColor(기본 --gold-light), 불꽃과 문자판은 고정색.
export default function DanteLogo({ size = 32, ...props }: { size?: number | string } & SVGProps<SVGSVGElement>) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" {...props}>
      <defs>
        <mask id={`${id}m`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="29" cy="39" r="20.3" fill="#000" />
        </mask>
        <radialGradient id={`${id}f`} cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#6e2118" />
          <stop offset="1" stopColor="#220b08" />
        </radialGradient>
      </defs>
      <g mask={`url(#${id}m)`}>
        <path fill="#9b2c23" d="M11 44C6 34 10 25 17 20C16 24 17 27 20 28C19 20 24 12 33 8C30 13 30 18 34 20C36 12 42 6 54 3C47 9 45 15 47 21C50 18 54 17 59 17C54 21 52 26 53 32C55 38 53 45 47 50Z" />
        <path fill="#e8b030" d="M17 38C16 32 18 28 21 26C21 29 22 31 24 32C24 25 28 19 33 16C32 20 33 24 37 25C39 18 43 14 49 11C46 16 45 21 48 26C50 24 52 24 55 24C51 28 50 32 50 37C50 41 48 44 45 46Z" />
      </g>
      <circle cx="29" cy="39" r="17" fill={`url(#${id}f)`} stroke="currentColor" strokeWidth="3" />
      <path d="M42.5 39H40M29 52.5V50M15.5 39H18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" opacity="0.8" />
      <g fill="currentColor">
        <path d="M29 24.2L29.8 26.7L32.3 27.5L29.8 28.3L29 30.8L28.2 28.3L25.7 27.5L28.2 26.7Z" />
        <path d="M27.7 41.5L29 30.5L30.3 41.5Z" />
        <path d="M27.6 41L29 31.5L30.4 41Z" transform="rotate(130 29 39)" />
        <circle cx="29" cy="39" r="2.4" />
      </g>
      <circle cx="29" cy="39" r="0.9" fill="#220b08" />
    </svg>
  )
}
