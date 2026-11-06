import { Svg, cut, diamond, star, type IconProps } from './Svg'

// Generic glyphs. Pure line drawings; a filled part only where the game's own icon is solid (play, checked boxes).

export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>

// The lens is the coin octagon.
export const SearchIcon = (p: IconProps) => <Svg {...p}><path d={cut(3.5, 3.5, 13.5, 13.5, 3.95)} /><path d="M15.1 15.1l5.4 5.4" /></Svg>

export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 12.5l5 5 10-10" /></Svg>

export const ArrowLeftIcon = (p: IconProps) => <Svg {...p}><path d="M20 12H5.5M11 6l-6 6 6 6" /></Svg>
export const ArrowRightIcon = (p: IconProps) => <Svg {...p}><path d="M4 12h14.5M13 6l6 6-6 6" /></Svg>
export const ArrowUpIcon = (p: IconProps) => <Svg {...p}><path d="M12 20V5.5M6 11l6-6 6 6" /></Svg>
export const ArrowDownIcon = (p: IconProps) => <Svg {...p}><path d="M12 4v14.5M6 13l6 6 6-6" /></Svg>
export const ArrowUpRightIcon = (p: IconProps) => <Svg {...p}><path d="M6.5 17.5l10-10M8 7h9v9" /></Svg>

export const ChevronDownIcon = (p: IconProps) => <Svg {...p}><path d="M6 9.5l6 6 6-6" /></Svg>
export const ChevronUpIcon = (p: IconProps) => <Svg {...p}><path d="M6 14.5l6-6 6 6" /></Svg>
export const ChevronLeftIcon = (p: IconProps) => <Svg {...p}><path d="M14.5 6l-6 6 6 6" /></Svg>
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M9.5 6l6 6-6 6" /></Svg>

export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const MinusIcon = (p: IconProps) => <Svg {...p}><path d="M5 12h14" /></Svg>

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 6.5h16M9 6.5V4h6v2.5M6.2 6.5l.9 12L8.6 20h6.8l1.5-1.5.9-12M10 10.5v5.5M14 10.5v5.5" /></Svg>
)

export const CopyIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(8.5, 8.5, 11.5, 11.5, 2.5)} /><path d="M15.5 8.5V6.5l-2-2h-7l-2 2v7l2 2h2" /></Svg>
)

export const EditIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 19.5v-4l10-10 4 4-10 10ZM12 8l4 4" /></Svg>

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}><path d="M8.5 10.5h-2L5 12v6.5L6.5 20h11l1.5-1.5V12l-1.5-1.5h-2M12 3.5v11M8.5 7L12 3.5 15.5 7" /></Svg>
)

export const ExternalLinkIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18.5 13.5v5L17 20H6l-1.5-1.5v-11L6 6h5M14 4h6v6M20 4l-8.5 8.5" /></Svg>
)

// Slider knobs are the game's diamond checkbox.
export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h7.2M15.8 7H20M4 12h3.2M11.8 12H20M4 17h9.2M17.8 17H20" />
    <path d={`${diamond(13.5, 7, 2.3)}${diamond(9.5, 12, 2.3)}${diamond(15.5, 17, 2.3)}`} />
  </Svg>
)

export const ResetIcon = (p: IconProps) => <Svg {...p}><path d="M5.4 8.5A7.5 7.5 0 1 1 4.5 12M4.6 4.2v4.4H9" /></Svg>

export const PlayIcon = (p: IconProps) => <Svg {...p}><path d="M8 5.5v13L18.5 12Z" fill="currentColor" /></Svg>

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M4.5 15v3.5L6 20h12l1.5-1.5V15" /></Svg>
)

const EYE = 'M2.5 12C4.8 7.8 8 5.5 12 5.5s7.2 2.3 9.5 6.5c-2.3 4.2-5.5 6.5-9.5 6.5S4.8 16.2 2.5 12Z'
export const EyeIcon = (p: IconProps) => <Svg {...p}><path d={EYE} /><path d={diamond(12, 12, 3)} fill="currentColor" stroke="none" /></Svg>
export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}><path d={EYE} /><path d={diamond(12, 12, 3)} fill="currentColor" stroke="none" /><path d="M4 3.5l16 17" /></Svg>
)

export const HeartIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 19.5C7 16.3 4 13 4 9.3 4 6.9 5.8 5 8.1 5c1.6 0 3 .9 3.9 2.3C12.9 5.9 14.3 5 15.9 5 18.2 5 20 6.9 20 9.3c0 3.7-3 7-8 10.2Z" /></Svg>
)

export const CommentIcon = (p: IconProps) => <Svg {...p}><path d="M6 4.5h12l2 2v8l-2 2h-6.5L7 20v-3.5H6l-2-2v-8Z" /></Svg>

export const ReplyIcon = (p: IconProps) => <Svg {...p}><path d="M9.5 6L4 11.5 9.5 17M4 11.5h10a6 6 0 0 1 6 6v1" /></Svg>

// People keep a round head; the shoulders take the octagon's cut.
export const UserIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20.5v-1.8l3-3.2h8l3 3.2v1.8" /></Svg>

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8.5" r="3" /><path d="M3 20v-1.5l2.5-3h7l2.5 3V20M15 5.6a3 3 0 0 1 0 5.8M16.5 15.5h1l2.5 3V20" /></Svg>
)

export const UserPlusIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9.5" cy="8" r="3.3" /><path d="M3.5 20v-1.6l2.7-3h6.6l1.4 1.6M18 9v6M15 12h6" /></Svg>
)

export const LayersIcon = (p: IconProps) => <Svg {...p}><path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8ZM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" /></Svg>

// Eight flat teeth like the game's SettingIcon, a diamond hub.
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.28 5.11L10.5 2.52h3l.22 2.59 1.94.8 1.98-1.68 2.13 2.13-1.68 1.98.8 1.94 2.59.22v3l-2.59.22-.8 1.94 1.68 1.98-2.13 2.13-1.98-1.68-1.94.8-.22 2.59h-3l-.22-2.59-1.94-.8-1.98 1.68-2.13-2.13 1.68-1.98-.8-1.94-2.59-.22v-3l2.59-.22.8-1.94-1.68-1.98 2.13-2.13 1.98 1.68Z" strokeWidth={1.8} />
    <path d={diamond(12, 12, 2.6)} fill="currentColor" stroke="none" />
  </Svg>
)

// 가 and A: the site speaks Korean first.
export const LanguageIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3.5 5.5h6c0 4.2-2 7.2-5.5 8.8M12.5 4v10M12.5 8.8h2.3M14 20.5l3.3-8.5 3.3 8.5M15.2 17.5h4.2" /></Svg>
)

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(4, 5.5, 16, 15, 2)} /><path d="M8.5 3v4.5M15.5 3v4.5M4 10.5h16" /><path d={star(15.2, 15.6, 2.7)} fill="currentColor" stroke="none" /></Svg>
)

export const LoginIcon = (p: IconProps) => <Svg {...p}><path d="M13.5 4H18l2 2v12l-2 2h-4.5M4 12h10.5M10.5 8l4 4-4 4" /></Svg>

export const MenuIcon = (p: IconProps) => <Svg {...p}><path d="M4 6.5h16M4 12h16M4 17.5h16" /></Svg>

export const BellIcon = (p: IconProps) => <Svg {...p}><path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 1.5h-15ZM12 3v2M10 21h4" /></Svg>

export const MailIcon = (p: IconProps) => <Svg {...p}><path d={cut(3, 5, 18, 14, 2)} /><path d="M3.5 6.5L12 13l8.5-6.5" /></Svg>

export const BookmarkIcon = (p: IconProps) => <Svg {...p}><path d="M8 3.5h8l2 2v15l-6-4.5-6 4.5v-15Z" /></Svg>

// Rows of the game's diamond checkbox, the first two ticked.
export const CheckListIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d={`${diamond(6, 6.5, 2.2)}${diamond(6, 12, 2.2)}`} fill="currentColor" stroke="none" />
    <path d={diamond(6, 17.5, 1.8)} strokeWidth={1.6} />
    <path d="M11 6.5h9M11 12h9M11 17.5h9" />
  </Svg>
)

export const PictureInPictureIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(3, 4.5, 18, 15, 2)} /><path d={cut(12, 12, 6, 5, 1)} fill="currentColor" stroke="none" /></Svg>
)

export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5c-2.4 2.4-3.6 5.2-3.6 8.5s1.2 6.1 3.6 8.5M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5M3.5 12h17" /></Svg>
)

export const MegaphoneIcon = (p: IconProps) => <Svg {...p}><path d="M4 9.5h3.5l9.5-5v15l-9.5-5H4ZM7.5 14.5l1.5 5h2.5l-1.3-4.3M20 10v4" /></Svg>

export const ClipboardIcon = (p: IconProps) => (
  <Svg {...p}><path d="M8 5H6.5L5 6.5v13L6.5 21h11l1.5-1.5v-13L17.5 5H16M9 3.5h6v3H9ZM8.5 11.5h7M8.5 15.5h4.5" /></Svg>
)

export const GripIcon = (p: IconProps) => (
  <Svg {...p}><path d={[[9, 6], [15, 6], [9, 12], [15, 12], [9, 18], [15, 18]].map(([x, y]) => diamond(x, y, 1.5)).join('')} fill="currentColor" stroke="none" /></Svg>
)

// Brand marks, drawn in the text colour.
export const XBrandIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor" stroke="none" /></Svg>
)

export const YoutubeIcon = (p: IconProps) => (
  <Svg {...p}><path d={cut(2.5, 5, 19, 14, 3)} /><path d="M10 9v6l5-3Z" fill="currentColor" stroke="none" /></Svg>
)
