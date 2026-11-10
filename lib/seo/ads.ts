/**
 * The site's ads on or off. Off since 2026-11-10 (owner): a week earned under a dollar, so the site grows first and the ads come
 * back once it leads. Off, no ad, reserved place or AdSense script is drawn; the account meta tag and public/ads.txt stay, so
 * turning this back on is the whole change.
 */
export const ADS_ON = false

/** The AdSense publisher of public/ads.txt; the account meta tag lets AdSense confirm the site without the ads.txt crawl. */
export const ADSENSE_ACCOUNT = 'ca-pub-4615018820773123'
/** One display ad unit (AdSense > Ads > By ad unit) per ad place, so the report shows what each place earns. */
export const ADSENSE_SLOTS = {
  /** saigo-no-dante: under a list page title */
  top: '2699879515',
  /** saigo-no-dante-2: between a detail page's parts (and the skill motion picker's phone banner) */
  inline: '1649300531',
  /** saigo-no-dante-3: the 160x600 side ads */
  rail: '1316313953',
  /** saigo-no-dante-4: the skill motion player's side panel */
  panel: '6377068943',
} as const

/**
 * Pages without the ad (DESIGN.md "광고"): the sinner list (the owner's call), a user's profile and collection, editors, assist, tool and full-screen screens (the skill motion player, not its picking page), account and admin pages, legal and
 * error pages. Other pages place their ads as DESIGN.md "광고" sets out.
 */
const AD_FREE = /^\/(?:sinners|decks\/new|decks\/[^/]+\/edit|planner|planner\/run(?:\/.*)?|friends\/new|login|mypage|guest|collection|users\/[^/]+|admin(?:\/.*)?|support|developers|terms|privacy|licenses|maintenance|offline|tools(?:\/.*)?|random|prescript(?:\/.*)?|motion\/skills\/watch(?:\/.*)?)\/?$/

/** An unknown path (usePathname outside the App Router) shows no ad. */
export function isAdFreePath(pathname: string | null): boolean {
  if (!pathname) return true
  const path = pathname.replace(/^\/(?:ko|en|ja)(?=\/|$)/, '') || '/'
  return AD_FREE.test(path)
}
