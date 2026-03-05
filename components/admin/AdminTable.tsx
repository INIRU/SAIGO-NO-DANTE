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
      <div style={{ padding: '24px', textAlign: 'center', color: '#555566', fontSize: '0.8125rem' }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  color: '#555566',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
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
              style={{ borderBottom: '1px solid rgba(58,42,21,0.2)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: '10px 12px',
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
