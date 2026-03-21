'use client'

import { useState } from 'react'
import { Download, X, ImageIcon } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'

type IncludeType = 'identity' | 'ego'
type GroupBy = 'sinner' | 'keyword'

interface DownloadModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (options: { include: Set<IncludeType>; groupBy: GroupBy }) => void
  generating: boolean
}

export default function DownloadModal({ open, onClose, onConfirm, generating }: DownloadModalProps) {
  const [include, setInclude] = useState<Set<IncludeType>>(new Set(['identity', 'ego']))
  const [groupBy, setGroupBy] = useState<GroupBy>('sinner')

  if (!open) return null

  const toggleInclude = (type: IncludeType) => {
    setInclude(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size <= 1) return prev  // 최소 1개 필수
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const canConfirm = include.size > 0 && !generating

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-2xl w-full max-w-sm mx-4"
        style={{ background: '#1a1510', border: '1px solid #3a3020' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2a2015' }}>
          <div className="flex items-center gap-2">
            <ImageIcon size={16} style={{ color: '#c8900a' }} />
            <span style={{ color: '#e8dcc8', fontSize: '0.875rem', fontWeight: 600 }}>이미지 다운로드</span>
          </div>
          <button onClick={onClose} style={{ color: '#666', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4 space-y-4">
          {/* 설명 */}
          <p style={{ color: '#888', fontSize: '0.75rem', lineHeight: 1.6 }}>
            보유 현황을 이미지로 저장합니다. 포함할 항목과 분류 방식을 선택하세요.
          </p>

          {/* 포함 항목 */}
          <div>
            <span style={{ color: '#aaa', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
              포함 항목
            </span>
            <div className="flex gap-2">
              {([['identity', '인격'], ['ego', 'E.G.O']] as [IncludeType, string][]).map(([type, label]) => {
                const active = include.has(type)
                return (
                  <button
                    key={type}
                    onClick={() => toggleInclude(type)}
                    className="flex-1 py-2 rounded text-xs font-medium transition-all duration-150"
                    style={{
                      background: active ? 'rgba(200,144,10,0.15)' : 'rgba(255,255,255,0.03)',
                      color: active ? '#e8b030' : '#666',
                      border: `1px solid ${active ? 'rgba(200,144,10,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 분류 옵션 */}
          <div>
            <span style={{ color: '#aaa', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
              분류
            </span>
            <Dropdown
              value={groupBy}
              options={[
                { value: 'sinner' as GroupBy, label: '수감자별' },
                { value: 'keyword' as GroupBy, label: '키워드별' },
              ]}
              onChange={setGroupBy}
              prefix="분류:"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid #2a2015' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded text-xs font-medium transition-all duration-150"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#888',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={() => onConfirm({ include, groupBy })}
            disabled={!canConfirm}
            className="flex-1 py-2.5 rounded text-xs font-medium transition-all duration-150 flex items-center justify-center gap-1.5"
            style={{
              background: canConfirm ? 'rgba(200,144,10,0.2)' : 'rgba(200,144,10,0.05)',
              color: canConfirm ? '#e8b030' : '#666',
              border: `1px solid ${canConfirm ? 'rgba(200,144,10,0.4)' : 'rgba(200,144,10,0.1)'}`,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            <Download size={12} />
            {generating ? '생성 중...' : '다운로드'}
          </button>
        </div>
      </div>
    </div>
  )
}
