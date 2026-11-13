'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import Skeleton, { SkeletonLine, SkeletonPage } from '@/components/ui/Skeleton'
import type { EGO, Sinner } from '@/lib/types'
import EgoDetailView from './EgoDetailView'

type ApiResponse = { ego: EGO; sinner: Sinner }

interface EgoDetailModalProps {
  egoId: string
  onClose: () => void
}

/** The E.G.O info window: the E.G.O page's own view (art, info, skills in the game's skill frame by stage, passive) in a window. */
export default function EgoDetailModal({ egoId, onClose }: EgoDetailModalProps) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/ego/${egoId}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((d: ApiResponse) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(t('ego.loadError')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egoId])

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="68rem" padding="1rem" title={t('ego.detailTitle')}>
      {/* one flat surface (DESIGN.md "게임 정보 창"): panel colour, 1px border, no glow */}
      <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded border border-[var(--border)] bg-[var(--bg-panel)] p-4 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute right-2 top-2 z-20 grid h-11 w-11 place-items-center rounded text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"
        >
          <X size={18} />
        </button>
        {loading && <LoadingSkeleton />}
        {error && <p className="p-6 text-center text-[0.875rem] text-[var(--error-text)]">{error}</p>}
        {data && !loading && <EgoDetailView sinner={data.sinner} ego={data.ego} embedded />}
      </div>
    </BaseModal>
  )
}

function LoadingSkeleton() {
  return (
    <SkeletonPage className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-24 w-24 shrink-0" />
        <div className="flex-1 space-y-2"><SkeletonLine w="50%" h="1.25rem" /><SkeletonLine w="30%" h="0.875rem" /></div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-3 border-t border-[#2e2417] pt-4">
          <Skeleton className="h-16 w-16 shrink-0" />
          <div className="flex-1 space-y-2"><SkeletonLine w="35%" h="0.875rem" /><SkeletonLine w="90%" h="0.75rem" /><SkeletonLine w="70%" h="0.75rem" /></div>
        </div>
      ))}
    </SkeletonPage>
  )
}
