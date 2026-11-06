'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCollectionModel } from '@/features/tools/hooks/useCollectionModel'
import CollectionBoard from '@/features/tools/components/CollectionBoard'
import CollectionSection from '@/features/account/components/CollectionSection'
import { decodeCollectionAsync, type CollectionData } from '@/lib/collection'

const PAGE = 'mx-auto max-w-[80rem] px-4 pb-16 pt-[calc(64px+1.5rem)] md:px-6'

/** /collection: without ?code it is the editor (saved in this browser, synced when signed in); with ?code a shared, read-only view. */
function CollectionViewer({ data }: { data: CollectionData }) {
  const t = useTranslations('collectionPage')
  const code = useSearchParams()?.get('code') ?? null
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [sinner, setSinner] = useState(data.sinners[0]?.id ?? '')
  const [keyword, setKeyword] = useState<string | null>(null)
  const [showUnowned, setShowUnowned] = useState(true)

  useEffect(() => {
    if (!code || data.sinners.length === 0) return
    decodeCollectionAsync(code, data.sinners, data.identities, data.egos)
      .then(setOwned)
      .catch(() => { /* malformed code: shows nothing owned */ })
  }, [code, data])

  const { stats, sinnerCounts, filtered } = useCollectionModel(data, owned, keyword)

  if (!code) return <div className={PAGE}><CollectionSection persistMode="local" titleAs="h1" initialData={data} /></div>

  return (
    <div className={PAGE}>
      <header className="mb-4 flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="font-[family-name:var(--font-heading)] text-[1.375rem] text-[var(--gold)] md:text-[1.75rem]">{t('sharedTitle')}</h1>
        <p className="flex gap-5 text-[0.875rem] text-[#9c8b73]">
          <span>{t('identities')} <b className="font-[family-name:var(--font-title)] text-[1.125rem] font-normal text-[var(--gold-light)]">{stats.ownedIdentities}</b>/{stats.totalIdentities}</span>
          <span>E.G.O <b className="font-[family-name:var(--font-title)] text-[1.125rem] font-normal text-[var(--gold-light)]">{stats.ownedEgos}</b>/{stats.totalEgos}</span>
        </p>
      </header>
      <CollectionBoard
        data={data}
        filtered={filtered}
        counts={sinnerCounts}
        owned={owned}
        sinner={sinner}
        onSinner={setSinner}
        keyword={keyword}
        onKeyword={setKeyword}
        showUnowned={showUnowned}
        onShowUnowned={setShowUnowned}
      />
    </div>
  )
}

export default function CollectionClient({ initialData }: { initialData: CollectionData }) {
  // useSearchParams needs a boundary; the editor and the viewer each render their own skeleton.
  return <Suspense fallback={null}><CollectionViewer data={initialData} /></Suspense>
}
