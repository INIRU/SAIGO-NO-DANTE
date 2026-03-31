import { type ReactNode } from 'react'

interface AdminCardProps {
  title?: string
  children: ReactNode
  style?: React.CSSProperties
  headerRight?: ReactNode
}

export function AdminCard({ title, children, style, headerRight }: AdminCardProps) {
  return (
    <div className="card" style={{ padding: '24px', marginBottom: '24px', ...style }}>
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
