import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useLocale } from 'next-intl'
import { MOTION_INDEX_URL, cutinAllyId, motionAssetUrl, motionCatalogFrom, type MotionEntry, type MotionPartner, type MotionSiteData, type MotionState } from '@/lib/motion/catalog'
import { getIdentityPortraitUrl } from '@/lib/utils/images'

const readJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}
const readSiteData = (url: string) => readJson<MotionSiteData>(url)
// The index changes with every upload: asked again on every page open, the browser checking its copy with R2 (304 when the same).
const readIndex = (url: string) => readJson<MotionEntry[]>(url, { cache: 'no-cache' })

/** The motion list both pages use: the R2 index (read by the browser itself, so a new video shows on the next page open) and the site's names for it. */
export function useMotionCatalog() {
  const lang = useLocale()
  const site = useSWR(`/api/motion/site-data?lang=${lang}`, readSiteData, { revalidateOnFocus: false })
  const index = useSWR(MOTION_INDEX_URL, readIndex, { revalidateOnFocus: false })
  const sinners = useMemo(() => site.data && index.data ? motionCatalogFrom(index.data, site.data, lang, new Date()) : undefined, [site.data, index.data, lang])
  const retry = () => Promise.all([site.mutate(), index.mutate()])
  const skillNames = useMemo(() => new Map(site.data?.skillNames), [site.data])
  const partner = useCallback((gameId: string): MotionPartner | undefined => {
    const info = site.data?.identities.find(identity => identity.game_id === gameId)
    return info && { gameId, name: info.name, sinner: info.sinner_name ?? null, portrait: info.folder_name ? getIdentityPortraitUrl(info.sinner_id, info.folder_name, gameId, false) : null }
  }, [site.data])
  return { sinners, error: site.error ?? index.error, retry, skillNames, partner }
}

/**
 * The ally of each cut-in scenario of a skill, by state. The index does not name them: the video's chapters do, so these
 * few layers.json are read for the rows (the browser keeps them for the video).
 */
export function useCutinAllies(skillKey: string | undefined, states: readonly MotionState[] | undefined, ownerGameId: string | null, partner: (gameId: string) => MotionPartner | undefined) {
  const cutins = states?.filter(s => /^v:cutin/.test(s.state)) ?? []
  const { data } = useSWR(cutins.length ? ['motion-cutins', skillKey] : null, () => Promise.all(cutins.map(async s => {
    const meta = await readJson<{ chapters?: { key: string }[] }>(motionAssetUrl(s.meta))
    return [s.state, cutinAllyId(meta.chapters, ownerGameId)] as const
  })), { revalidateOnFocus: false })
  return useMemo(() => Object.fromEntries((data ?? []).flatMap(([state, id]) => {
    const person = id ? partner(id) : undefined
    return person ? [[state, person]] : []
  })), [data, partner])
}
