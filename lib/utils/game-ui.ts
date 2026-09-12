import versions from '@/lib/generated/game-ui-versions.json'

/** Content version changes invalidate both the Next image cache and the service worker. */
export function getGameUiAsset(name: string): string {
  const version = versions[name as keyof typeof versions]
  if (!version) throw new Error(`Unknown game UI asset: ${name}`)
  return `/assets/game-ui/${name}.webp?v=${version}`
}
