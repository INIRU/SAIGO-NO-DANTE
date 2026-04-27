'use client'

import { type ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render: (item: T, index: number) => ReactNode
  width?: string
}

interface AdminTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
}

export function AdminTable<T>({ columns, data, keyExtractor, emptyMessage = '데이터가 없습니다.' }: AdminTableProps<T>) {
  if (data.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888888', fontSize: '0.8125rem' }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', border: '0.0625rem solid rgba(200,144,10,0.12)', borderRadius: '0.375rem', background: 'rgba(13,11,8,0.38)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '0.0625rem solid var(--border)' }}>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: '0.625rem 0.75rem',
                  color: '#888888',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0,
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={keyExtractor(item)}
              className="transition-colors"
              style={{ borderBottom: '0.0625rem solid rgba(58,42,21,0.2)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: '0.625rem 0.75rem',
                    fontSize: '0.8125rem',
                    color: '#c8a450',
                  }}
                >
                  {col.render(item, idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
