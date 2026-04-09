'use client'
import dynamic from 'next/dynamic'

const Inner = dynamic(() => import('./RunClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
      <div className="animate-pulse text-center">
        <div className="h-8 w-48 rounded mx-auto mb-4" style={{ background: 'rgba(200,144,10,0.1)' }} />
        <div className="h-4 w-32 rounded mx-auto" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  ),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RunWrapper(props: any) {
  return <Inner {...props} />
}
