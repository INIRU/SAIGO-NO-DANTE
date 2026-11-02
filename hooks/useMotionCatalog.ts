import { useMemo } from 'react'
import useSWR from 'swr'
import { useLocale } from 'next-intl'
import { MOTION_INDEX_URL, motionCatalogFrom, type MotionEntry, type MotionSiteData } from '@/lib/motion/catalog'

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
  return { sinners, error: site.error ?? index.error, retry }
}
