'use client'
import dynamic from 'next/dynamic'

function BuilderSkeleton() {
  return (
    <div className="animate-pulse" style={{ minHeight: '100dvh', background: 'var(--bg-deep)', paddingTop: '5rem' }}>
      <div style={{ maxWidth: '90rem', margin: '0 auto', padding: '0 1.5rem', display: 'grid', gridTemplateColumns: '1fr 20rem', gap: '1.5rem' }}>
        <div style={{ background: '#1a1510', borderRadius: '0.5rem', height: '80vh' }} />
        <div style={{ background: '#1a1510', borderRadius: '0.5rem', height: '80vh' }} />
      </div>
    </div>
  )
}

const Inner = dynamic(() => import('./DeckBuilderClient'), {
  ssr: false,
  loading: () => <BuilderSkeleton />,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DeckBuilderWrapper(props: any) {
  return <Inner {...props} />
}
