/**
 * Pages without the ad (DESIGN.md "광고"): the sinner list (the owner's call), editors, assist, tool and full-screen screens (the skill motion player, not its picking page), account and admin pages, legal and
 * error pages. Every other page shows one ad at its very end, above the footer.
 */
const AD_FREE = /^\/(?:sinners|decks\/new|decks\/[^/]+\/edit|planner|planner\/run(?:\/.*)?|friends\/new|login|mypage|guest|admin(?:\/.*)?|support|developers|terms|privacy|licenses|maintenance|offline|tools(?:\/.*)?|random|prescript(?:\/.*)?|motion\/skills\/watch(?:\/.*)?)\/?$/

/** An unknown path (usePathname outside the App Router) shows no ad. */
export function isAdFreePath(pathname: string | null): boolean {
  if (!pathname) return true
  const path = pathname.replace(/^\/(?:ko|en|ja)(?=\/|$)/, '') || '/'
  return AD_FREE.test(path)
}
