'use client'
import dynamic from 'next/dynamic'

const ExtractionScene = dynamic(() => import('./ExtractionScene'), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0d0b08' }}
    >
      <div className="text-center">
        <p
          style={{
            color: 'var(--gold-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.3em',
          }}
        >
          LOADING...
        </p>
      </div>
    </div>
  ),
})

export default function ExtractionWrapper() {
  return <ExtractionScene />
}
