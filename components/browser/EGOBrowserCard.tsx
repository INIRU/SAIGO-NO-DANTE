'use client'

import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import type { EGOBrowserItem } from '@/lib/types/browser'

type Props = {
  ego: EGOBrowserItem
}

export default function EGOBrowserCard({ ego }: Props) {
  return (
    <EgoDisplayCard
      ego={ego}
      href={`/sinners/${ego.sinner_slug}/ego/${ego.id}`}
      name={ego.name_kr || ego.name}
      sinnerId={ego.sinner_id}
    />
  )
}
