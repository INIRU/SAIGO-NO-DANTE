import { Svg, cut, diamond, star, type IconProps } from './Svg'

// Section icons: one object from the game each, with one solid part, like the game's focused menu icons.

const fill = { fill: 'currentColor', stroke: 'none' } as const

// Sinners: the octagon medal with Dante's star breaking through at twelve o'clock.
export const SinnerRosterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.4 2.5H8.1L2.5 8.1v7.8l5.6 5.6h7.8l5.6-5.6V8.1l-5.6-5.6h-1.3" />
    <path d={star(12, 3, 2.7)} {...fill} />
    <circle cx="12" cy="10.2" r="2.5" />
    <path d="M7.5 17.5v-.6l2-2h5l2 2v.6" />
  </Svg>
)

// Keyword: a status tag with a diamond eyelet.
export const KeywordIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 5.5l2-2h7l8 8-9 9-8-8Z" /><path d={diamond(8, 8, 1.8)} {...fill} /></Svg>
)

// Deck board: two cards, the front one with a solid header and the formation diamond.
export const DeckBoardIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(3.5, 6.5, 9.5, 13.5, 1.8)} transform="rotate(-10 8.25 13.25)" opacity="0.55" />
    <path d={cut(9, 3.5, 11, 17, 2)} />
    <path d="M11 3.5h7l2 2v2H9v-2Z" {...fill} />
    <path d={diamond(14.5, 13.5, 2.6)} />
  </Svg>
)

// Lunacy: the cut gem, its table solid.
export const LunacyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4h8l4 5-8 11L4 9ZM4 9h16M9.5 9L12 20l2.5-11" />
    <path d="M8.6 4.8h6.8L14.2 8H9.8Z" {...fill} />
  </Svg>
)

// Mirror dungeon: a mirror inside a mirror, one floor down each time.
export const MirrorDungeonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(4, 2.5, 16, 19, 3)} />
    <path d={cut(7.5, 7.5, 9, 10.5, 2)} strokeWidth={1.6} opacity="0.75" />
    <path d={cut(10, 12.5, 4, 4, 1)} {...fill} />
    <path d="M6.8 6.7l1.6-1.6" strokeWidth={1.5} opacity="0.7" />
  </Svg>
)
