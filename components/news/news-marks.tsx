import Image from 'next/image'
import type { NEWS_FEEDS, NEWS_PLATFORMS } from '@/lib/news/payload'

type Feed = (typeof NEWS_FEEDS)[number]
type Platform = (typeof NEWS_PLATFORMS)[number]

// The pictures of the official accounts (public/assets/news): Limbus Company and Project Moon on X, HamHamPangPang's logo.
const FEED_LOGO: Record<Feed, string> = {
  limbus: '/assets/news/feed-limbus.png',
  project_moon: '/assets/news/feed-project-moon.png',
  hampang: '/assets/news/feed-hampang.png',
}

/** The round picture of the account a kind of news comes from. `size` is a CSS length. */
export function FeedLogo({ feed, size = '1.25rem', className = '' }: { feed: Feed; size?: string; className?: string }) {
  return <Image src={FEED_LOGO[feed]} alt="" width={128} height={128} className={`shrink-0 rounded-full bg-[var(--bg-deep)] object-cover ring-1 ring-black/40 ${className}`} style={{ width: size, height: size }} />
}

// Brand marks from Simple Icons (CC0), drawn in the text colour.
const PLATFORM_PATH: Partial<Record<Platform, string>> = {
  steam: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z',
  x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
}

/** The mark of where a news item was published. A notice the bot wrote itself (`partner`) is marked with the Limpi runner. */
export function PlatformIcon({ platform, size = '0.875rem', className = '' }: { platform: Platform; size?: string; className?: string }) {
  const path = PLATFORM_PATH[platform]
  if (path) return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} style={{ width: size, height: size }}><path d={path} /></svg>
  return platform === 'chzzk'
    ? <Image src="/assets/news/platform-chzzk.png" alt="" width={64} height={64} className={`shrink-0 rounded-[22%] ${className}`} style={{ width: size, height: size }} />
    : <Image src="/assets/limpi/runner.png" alt="" width={1032} height={1232} unoptimized className={`shrink-0 object-contain [image-rendering:pixelated] ${className}`} style={{ width: size, height: size }} />
}
