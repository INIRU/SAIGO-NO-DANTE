import { useId } from 'react'
import type { AchievementGlyph, AchievementTier } from '@/features/community/lib/achievements'

const METAL: Record<AchievementTier, [string, string, string]> = {
  1: ['#f2b98a', '#b8683a', '#6e3a1a'], // bronze
  2: ['#f6f3ec', '#b3ada3', '#6d6860'], // silver
  3: ['#ffe28e', '#e8b030', '#9a6a08'], // gold
}
const OUTER = '22,3 50,3 69,22 69,50 50,69 22,69 3,50 3,22'
const INNER = '25,10 47,10 62,25 62,47 47,62 25,62 10,47 10,25'

function compact(goal: number) {
  return goal >= 1000 ? `${goal / 1000}K` : String(goal)
}

/** Octagonal medal (the gift slot's octagon) with a metal rim per tier; unearned badges stay dark, secret ones show "?". */
export default function AchievementBadge({ glyph, tier, goal, earned, secret = false, className }: {
  glyph: AchievementGlyph
  tier: AchievementTier
  goal: number
  earned: boolean
  secret?: boolean
  className?: string
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [light, mid, dark] = METAL[tier]
  const metal = earned ? `url(#m${id})` : '#4a3a24'
  const card = earned ? '#1c140c' : '#120e09'
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true" data-earned={earned || undefined}>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`f${id}`} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor={earned ? '#2c2014' : '#17120c'} />
          <stop offset="1" stopColor="#0d0b08" />
        </radialGradient>
        <clipPath id={`c${id}`}><polygon points={INNER} /></clipPath>
      </defs>
      <polygon points={OUTER} fill={`url(#f${id})`} stroke={earned ? metal : '#3a2a15'} strokeWidth="3" strokeLinejoin="round" />
      {secret && (
        <text x="36" y="47" textAnchor="middle" fill="#5a4526" fontSize="30" fontWeight="700" style={{ fontFamily: 'var(--font-heading), var(--font-body), sans-serif' }}>?</text>
      )}
      {!secret && glyph === 'faust' && (
        <g clipPath={`url(#c${id})`}>
          <image href="/assets/home/faust-0.webp" x="10" y="8" width="52" height="57" preserveAspectRatio="xMidYMin slice" />
          {!earned && <rect x="0" y="0" width="72" height="72" fill="#0d0b08" opacity="0.72" />}
        </g>
      )}
      <polygon points={INNER} fill="none" stroke={earned ? metal : '#2e2417'} strokeWidth="1" strokeOpacity="0.55" strokeLinejoin="round" />
      {!secret && glyph === 'clock' && (
        <g fill="none" stroke={metal} strokeLinecap="round">
          <circle cx="36" cy="37" r="14" strokeWidth="3" fill={card} />
          <path d="M36 37 V28 M36 37 L43 41" strokeWidth="2.5" />
          <path d="M30 20 Q33 14 36 17 Q38 11 42 15" strokeWidth="2" />
        </g>
      )}
      {!secret && glyph === 'star' && (
        <g>
          <path d="M36 16 L41.3 29.5 L55.5 30 L44.5 39 L48.3 53 L36 45 L23.7 53 L27.5 39 L16.5 30 L30.7 29.5Z" fill={metal} />
          <path d="M36 18 L33 30 L39 36 L34 46 L37 52" fill="none" stroke="#120e09" strokeWidth="2" strokeLinejoin="round" />
        </g>
      )}
      {!secret && glyph === 'konami' && (
        <g fill={metal}>
          <path d="M21 34 L26 27 L31 34Z" /><path d="M41 34 L46 27 L51 34Z" />
          <path d="M21 39 L26 46 L31 39Z" /><path d="M41 39 L46 46 L51 39Z" />
          <text x="36" y="56" textAnchor="middle" fontSize="9" letterSpacing="1" style={{ fontFamily: 'var(--font-title), sans-serif' }}>B A</text>
        </g>
      )}
      {!secret && glyph === 'lost' && (
        <text x="36" y="45" textAnchor="middle" fill={metal} fontSize="22" letterSpacing="0.5" style={{ fontFamily: 'var(--font-title), var(--font-logo), sans-serif' }}>404</text>
      )}
      {!secret && glyph === 'egg' && (
        <g stroke={metal} strokeLinejoin="round">
          <path d="M36 16 C45 16 51 30 51 39 C51 48 44.5 54 36 54 C27.5 54 21 48 21 39 C21 30 27 16 36 16Z" fill={card} strokeWidth="2.5" />
          <path d="M23 38 L28 34 L32 39 L36 34 L40 39 L44 34 L49 38" fill="none" strokeWidth="2" />
        </g>
      )}
      {glyph === 'deck' && (
        <g stroke={metal} strokeWidth="2" strokeLinejoin="round" fill={card}>
          <rect x="25" y="21" width="19" height="27" rx="2" transform="rotate(-14 34.5 34.5)" />
          <rect x="27" y="22" width="19" height="27" rx="2" />
          <rect x="29" y="23" width="19" height="27" rx="2" transform="rotate(14 38.5 36.5)" />
        </g>
      )}
      {glyph === 'plan' && (
        <g fill="none" stroke={metal} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 25 H28 V33 H37 V41 H46 V49 H53" />
          <path d="M47 21 L53 27 L47 33" strokeWidth="2.5" transform="rotate(90 50 27)" />
        </g>
      )}
      {glyph === 'like' && (
        <path d="M36 51 C23 43 18 37 18 30.5 C18 25.5 22 22 26.5 22 C30.5 22 33.5 24.5 36 28 C38.5 24.5 41.5 22 45.5 22 C50 22 54 25.5 54 30.5 C54 37 49 43 36 51Z" fill={metal} />
      )}
      {glyph === 'points' && (
        <>
          <path d="M36 15 L38.2 20 L43.5 20.5 L39.5 24 L40.7 29.2 L36 26.5 L31.3 29.2 L32.5 24 L28.5 20.5 L33.8 20Z" fill={metal} />
          <text x="36" y="52" textAnchor="middle" fill={metal} fontSize="21" letterSpacing="0.5" style={{ fontFamily: "var(--font-title), var(--font-logo), sans-serif" }}>{compact(goal)}</text>
        </>
      )}
    </svg>
  )
}
