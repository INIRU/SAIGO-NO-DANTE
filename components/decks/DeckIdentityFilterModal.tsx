'use client'

import { X } from 'lucide-react'
import type { Identity } from '@/lib/data/sinners'
import IdentityCard from '@/components/sinners/IdentityCard'
import BaseModal from '@/components/ui/BaseModal'

export type DeckFilterSinner = {
  id: string
  name_kr: string
  order_num: number
}

export type DeckFilterIdentity = Identity & {
  sinner?: DeckFilterSinner | null
}

interface DeckIdentityFilterModalProps {
  open: boolean
  sinner: DeckFilterSinner | null
  identities: DeckFilterIdentity[]
  selectedIdentityIds: Set<string>
  onToggleIdentity: (identityId: string) => void
  onClose: () => void
}

export default function DeckIdentityFilterModal({
  open,
  sinner,
  identities,
  selectedIdentityIds,
  onToggleIdentity,
  onClose,
}: DeckIdentityFilterModalProps) {
  return (
    <BaseModal
      open={open}
      onClose={onClose}
      maxWidth="46rem"
      padding="calc(env(safe-area-inset-top) + 0.75rem) calc(env(safe-area-inset-right) + 0.75rem) calc(env(safe-area-inset-bottom) + 0.75rem) calc(env(safe-area-inset-left) + 0.75rem)"
      title={sinner ? `${sinner.name_kr} 인격 선택` : '인격 선택'}
      description="덱 목록 필터에 사용할 인격을 선택합니다."
    >
      <div
        className="max-h-[82dvh] overflow-hidden rounded-md"
        style={{
          background: '#16110c',
          border: '1px solid rgba(200,144,10,0.18)',
          boxShadow: '0 1rem 2rem rgba(0,0,0,0.34)',
        }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
          style={{ borderBottom: '1px solid rgba(200,144,10,0.14)' }}
        >
          <div className="min-w-0 flex-1">
            <p
              style={{ color: '#8f8066', fontFamily: 'var(--font-heading)', fontSize: '0.8125rem', letterSpacing: '0.08em', lineHeight: 1.2 }}
            >
              IDENTITY FILTER
            </p>
            <h2
              className="truncate"
              style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.35 }}
            >
              {sinner ? `${String(sinner.order_num).padStart(2, '0')} ${sinner.name_kr}` : '인격 선택'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center rounded transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
            style={{ width: '2.75rem', height: '2.75rem', color: '#9a938a', cursor: 'pointer' }}
            aria-label="인격 선택 모달 닫기"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(82dvh-4.25rem)] overflow-x-hidden overflow-y-auto px-3 py-5 overscroll-contain scrollbar-thin sm:px-5 sm:py-6">
          {identities.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-12 overflow-visible pb-10 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-14 md:grid-cols-4">
              {identities.map(identity => {
                const selected = selectedIdentityIds.has(identity.id)
                return (
                  <button
                    key={identity.id}
                    onClick={() => onToggleIdentity(identity.id)}
                    className="relative overflow-visible p-0 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                    style={{
                      minHeight: '2.75rem',
                      background: 'transparent',
                      border: '0',
                      cursor: 'pointer',
                    }}
                    aria-pressed={selected}
                    aria-label={`${identity.name_kr} ${selected ? '필터에서 제거' : '필터에 추가'}`}
                  >
                    <IdentityCard identity={identity} compact selected={selected} />
                  </button>
                )
              })}
            </div>
          ) : (
            <p style={{ color: '#888', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              이 수감자의 인격을 불러오지 못했습니다.
            </p>
          )}
        </div>
      </div>
    </BaseModal>
  )
}
