import { type ReactNode } from 'react'

interface AdminCardProps {
  title?: string
  children: ReactNode
  style?: React.CSSProperties
  headerRight?: ReactNode
}

export function AdminCard({ title, children, style, headerRight }: AdminCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        marginBottom: '1.25rem',
        borderColor: 'rgba(200,144,10,0.16)',
        background: 'rgba(26,21,16,0.72)',
        ...style,
      }}
    >
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 className="font-serif" style={{ color: '#c8a450', fontSize: '0.9375rem', fontWeight: 'bold' }}>
            {title}
          </h2>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  )
}
