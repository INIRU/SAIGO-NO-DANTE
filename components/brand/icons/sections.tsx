import { Svg, cut, diamond, star, type IconProps } from './Svg'

// Section icons: one object from the game each, with one solid part, like the game's focused menu icons.

const fill = { fill: 'currentColor', stroke: 'none' } as const

// DB: a stack of clash coins seen from the side, the top face solid.
export const DatabaseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(4, 5, 16, 6, 2)} fill="currentColor" />
    <path d="M4 9v4l2 2h12l2-2V9M4 13v4l2 2h12l2-2v-4" />
  </Svg>
)

// Sinners: the octagon medal with Dante's star breaking through at twelve o'clock.
export const SinnerRosterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.4 2.5H8.1L2.5 8.1v7.8l5.6 5.6h7.8l5.6-5.6V8.1l-5.6-5.6h-1.3" />
    <path d={star(12, 3, 2.7)} {...fill} />
    <circle cx="12" cy="10.2" r="2.5" />
    <path d="M7.5 17.5v-.6l2-2h5l2 2v.6" />
  </Svg>
)

// Identity: the identity card, its rarity band solid.
export const IdentityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(5, 2.5, 14, 19, 2.5)} />
    <path d="M7.5 2.5h9L19 5v1.5H5V5Z" {...fill} />
    <circle cx="12" cy="11" r="2.4" />
    <path d="M8.5 18v-.4l1.6-1.8h3.8l1.6 1.8v.4" />
  </Svg>
)

// E.G.O: the flame of the logo around a solid core.
export const EgoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3 1.9-4.7 3.2-7.5.5 1.6 1.3 2.6 2.4 3C11.2 7 12.8 4.4 15.6 2.8c-.5 2.9.5 4.7 1.8 6.6 1 1.5 2.1 3.2 2.1 5.6 0 3.4-2.9 6-7.5 6Z" />
    <path d={diamond(12, 16, 2.6)} {...fill} />
  </Svg>
)

// E.G.O gift: the octagonal gift slot of the shop.
export const GiftIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(3, 3, 18, 18, 5.3)} /><path d={star(12, 12, 4.8)} {...fill} /></Svg>
)

// Theme pack: the tall pack card with its name plate.
export const ThemePackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 16.5V5.5l2-2h7l2 2v11" />
    <path d="M5.5 15.5h13v4l-2 2h-9l-2-2Z" {...fill} />
    <path d={diamond(12, 9.5, 2.5)} />
  </Svg>
)

// Event: a choice. The road splits at a solid node.
export const EventIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21v-6.5M10.6 11.1L6.5 7M13.4 11.1L17.5 7M6 11.5V6.5h5M18 11.5V6.5h-5" />
    <path d={diamond(12, 12.5, 2.3)} {...fill} />
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

// Planner: a route down the floors, from a solid start.
export const PlanIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(3.5, 2.5, 6, 6, 1.7)} {...fill} />
    <path d={`${cut(14.5, 9, 6, 6, 1.7)}${cut(3.5, 15.5, 6, 6, 1.7)}`} />
    <path d="M9.5 7.5l5 3M14.5 13.5l-5 3" />
  </Svg>
)

// Friend codes: the manager's card, a face and a code.
export const FriendsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(2.5, 5, 19, 14, 2)} />
    <circle cx="8" cy="10.5" r="2" {...fill} />
    <path d="M4.8 16.5v-.3l1.5-1.6h3.4l1.5 1.6v.3M13.5 10h5M13.5 14h3.5" />
  </Svg>
)

// Board / collection: gift slots, one filled.
export const BoardIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={`${cut(3, 3, 7.5, 7.5, 1.4)}${cut(13.5, 3, 7.5, 7.5, 1.4)}${cut(3, 13.5, 7.5, 7.5, 1.4)}`} />
    <path d={cut(13.5, 13.5, 7.5, 7.5, 1.4)} {...fill} />
  </Svg>
)

// Community: two speech panels, a diamond in the front one.
export const CommunityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5.5V4.5L13.5 3h-9L3 4.5v6L4.5 12H6v3l2.8-2.5" />
    <path d="M11 8.5h8.5L21 10v6l-1.5 1.5H18V21l-3.8-3.5H11L9.5 16v-6Z" />
    <path d={diamond(15.25, 13, 2)} {...fill} />
  </Svg>
)

// Tools: a gauge, its needle solid.
export const ToolsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 18a8.5 8.5 0 0 1 17 0M12 9.5v2M6 12l1.4 1.4M18 12l-1.4 1.4" />
    <path d="M16.6 11.4L13 18.8 11 17.2Z" {...fill} />
    <path d="M3.5 21h17" />
  </Svg>
)

// Analysis: three bars, the leader solid.
export const MetaIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={`${cut(3.5, 13, 4.5, 7.5, 1)}${cut(16, 9.5, 4.5, 11, 1)}`} />
    <path d={cut(9.75, 4, 4.5, 16.5, 1)} fill="currentColor" />
  </Svg>
)

// Experience: the experience ticket with its perforation.
export const ExperienceIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 4.5h15L21 6v3a3 3 0 0 0 0 6v3l-1.5 1.5h-15L3 18v-3a3 3 0 0 0 0-6V6Z" />
    <path d="M15 7v1.8M15 11.1v1.8M15 15.2V17" />
    <path d={star(9, 12, 3)} {...fill} />
  </Svg>
)

// Lunacy: the cut gem, its table solid.
export const LunacyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4h8l4 5-8 11L4 9ZM4 9h16M9.5 9L12 20l2.5-11" />
    <path d="M8.6 4.8h6.8L14.2 8H9.8Z" {...fill} />
  </Svg>
)

// Damage: the clock star burst open.
export const DamageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5L13.38 8.67 16.38 7.62 15.33 10.62 20.5 12 15.33 13.38 16.38 16.38 13.38 15.33 12 20.5 10.62 15.33 7.62 16.38 8.67 13.38 3.5 12 8.67 10.62 7.62 7.62 10.62 8.67Z" />
    <path d={diamond(12, 12, 1.8)} {...fill} />
  </Svg>
)

// Clash: two coins meeting, sparks above.
export const ClashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(2, 10, 9, 9, 2.6)} />
    <path d={cut(13, 10, 9, 9, 2.6)} {...fill} />
    <path d="M12 3v4M8.2 4.5l1.6 2.6M15.8 4.5l-1.6 2.6" />
  </Svg>
)

export const DevelopersIcon = (p: IconProps) => <Svg {...p}><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" /></Svg>

// Motion: a play mark inside the coin.
export const MotionIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(3, 3, 18, 18, 5.3)} /><path d="M10 8.5v7l6-3.5Z" {...fill} /></Svg>
)

// Fun / random: a die with diamond pips.
export const FunIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(4, 4, 16, 16, 3.5)} />
    <path d={`${diamond(8.7, 8.7, 1.7)}${diamond(12, 12, 1.7)}${diamond(15.3, 15.3, 1.7)}`} {...fill} />
  </Svg>
)

// Index prescript: an order slip with its seal.
export const PrescriptIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={cut(5, 3, 14, 18, 2)} />
    <path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h3.5" />
    <path d={diamond(15, 16.5, 2.2)} {...fill} />
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
