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
