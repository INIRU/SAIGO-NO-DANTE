'use client'

import { Suspense } from 'react'
import CollectionSection from '@/features/account/components/CollectionSection'

// Design Ref: §5.5 — CollectionSection 래퍼
type Props = {
  savedCode: string | null
}

export default function CollectionTab({ savedCode }: Props) {
  return (
    <Suspense
      fallback={
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1.5rem' }}>
          <div style={{ width: '8.75rem', height: '0.875rem', background: '#2a2015', borderRadius: '0.125rem' }} />
        </div>
      }
    >
      <CollectionSection savedCode={savedCode} />
    </Suspense>
  )
}
