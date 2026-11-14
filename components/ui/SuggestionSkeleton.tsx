import type { CSSProperties } from 'react'
import Skeleton, { SkeletonCircle, SkeletonLine, SkeletonPage } from './Skeleton'

/**
 * Loading shapes of the "추천" group of the pickers (deck builder identity and E.G.O. pickers, planner theme pack and gift
 * pickers): the ribbon title bar, the tiles of the real cards and, for identities and E.G.O.s, the partner faces and the reason
 * line. They sit where the group will be, so a group that arrives pushes nothing; one that ends up empty simply goes.
 */
const RIBBON_CLIP = 'polygon(0 0, 100% 0, calc(100% - 0.5rem) 50%, 100% 100%, 0 100%)'

/** The ribbon (24px, swallow-tail) and, for identity and E.G.O. groups, the line of the archetype beside it. */
export function SuggestionTitleSkeleton({ archetype = false }: { archetype?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" data-suggestion-title-skeleton>
      <Skeleton raised className="!rounded-none" style={{ width: '4.5rem', height: '1.5rem', clipPath: RIBBON_CLIP }} />
      {archetype && <SkeletonLine w="5rem" h="0.9375rem" />}
    </span>
  )
}

/** The note under a suggested card: "잘 맞는" and three overlapping 28px faces, then one line of reasons. */
function SuggestionNoteSkeleton() {
  return (
    <div className="@container mt-1.5 min-w-0" data-suggestion-note-skeleton>
      <div className="flex items-center">
        <SkeletonLine w="2rem" h="0.6875rem" className="mr-1.5 @max-[8rem]:hidden" />
        {[0, 1, 2].map(index => <SkeletonCircle key={index} size="1.75rem" raised className={index ? '-ml-1.5' : ''} />)}
      </div>
      <SkeletonLine w="70%" h="0.8125rem" className="mt-1" />
    </div>
  )
}

/** An identity card (290:428) with its note. */
export function IdentityTileSkeleton({ note = true }: { note?: boolean }) {
  return (
    <div className="min-w-0" data-tile-skeleton="identity">
      <Skeleton raised className="w-full" style={{ aspectRatio: '290 / 428' }} />
      {note && <SuggestionNoteSkeleton />}
    </div>
  )
}

/** An E.G.O. card: the round art, the badge above it and the name line, with its note. */
function EgoTileSkeleton({ note = true }: { note?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center" data-tile-skeleton="ego">
      <div className="flex w-full max-w-[9.5rem] flex-col items-center sm:max-w-[10rem]" style={{ paddingTop: '1.05rem' }}>
        <SkeletonCircle size="8.35rem" raised />
        <SkeletonLine w="60%" h="1rem" className="mt-2" raised />
      </div>
      {note && <div className="w-full max-w-[9.5rem] sm:max-w-[10rem]"><SuggestionNoteSkeleton /></div>}
    </div>
  )
}

/** A theme pack poster (416:684). */
export function ThemeTileSkeleton() {
  return <Skeleton raised className="w-full" style={{ aspectRatio: '416 / 684' }} />
}

/** A gift tile: the square icon cell of the gift grid. */
function GiftTileSkeleton() {
  return <Skeleton raised className="w-full" style={{ aspectRatio: '1' }} />
}

type Shape = 'identity' | 'ego' | 'theme' | 'gift'

/** The tiles of one group, in the grid the real group uses (pass its class or style). */
function SuggestionTilesSkeleton({ shape, count, className, style }: { shape: Shape; count: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={className} style={style}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-w-0">
          {shape === 'identity' ? <IdentityTileSkeleton /> : shape === 'ego' ? <EgoTileSkeleton /> : shape === 'theme' ? <ThemeTileSkeleton /> : <GiftTileSkeleton />}
        </div>
      ))}
    </div>
  )
}

/** The group while it loads, as a status region (screen readers hear "loading"; the bones are hidden). */
export function SuggestionGroupSkeleton({ shape, count, tilesClassName, tilesStyle, titleClassName = '', archetype = false }: {
  shape: Shape
  count: number
  /** The grid classes of the real group. */
  tilesClassName: string
  tilesStyle?: CSSProperties
  titleClassName?: string
  archetype?: boolean
}) {
  return (
    <SkeletonPage>
      <div className={titleClassName} data-suggestion-skeleton={shape}><SuggestionTitleSkeleton archetype={archetype} /></div>
      <SuggestionTilesSkeleton shape={shape} count={count} className={tilesClassName} style={tilesStyle} />
    </SkeletonPage>
  )
}

/** The gift picker's "추천" group: the ribbon over its rule and the gift cells of the catalog grid. */
export function GiftGroupSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SkeletonPage>
      <section className="mb-5" data-suggestion-skeleton="gift">
        <div className="mb-2 flex items-center gap-2" style={{ borderBottom: '1px solid #2e2417', paddingBottom: '0.375rem' }}><SuggestionTitleSkeleton /></div>
        <div className="gift-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--gift-catalog-cell, 4.5rem), 1fr))', gap: '0.5rem 0.375rem' }}>
          {Array.from({ length: count }, (_, index) => <GiftTileSkeleton key={index} />)}
        </div>
      </section>
    </SkeletonPage>
  )
}
