'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, X, ImageIcon } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import Button from '@/components/ui/Button'
import Dropdown from '@/components/ui/Dropdown'

type IncludeType = 'identity' | 'ego'
type GroupBy = 'sinner' | 'keyword'

interface DownloadModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (options: { include: Set<IncludeType>; groupBy: GroupBy }) => void
  generating: boolean
}

const SECTION_LABEL = 'mb-2 block text-[0.6875rem] font-semibold tracking-[0.05em] text-[var(--text-secondary)]'

export default function DownloadModal({ open, onClose, onConfirm, generating }: DownloadModalProps) {
  const t = useTranslations('collectionPage')
  const [include, setInclude] = useState<Set<IncludeType>>(new Set(['identity', 'ego']))
  const [groupBy, setGroupBy] = useState<GroupBy>('sinner')

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
    <BaseModal open={open} onClose={onClose} title={t('downloadTitle')} maxWidth="24rem" zIndex={300}>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2 pl-5 pr-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-[var(--gold)]" aria-hidden="true" />
            <span className="text-[0.875rem] font-semibold text-[var(--text-primary)]">{t('downloadTitle')}</span>
          </div>
          <Button variant="ghost" icon={X} aria-label={t('close')} onClick={onClose} />
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{t('downloadDesc')}</p>

          <div>
            <span className={SECTION_LABEL}>{t('include')}</span>
            <div className="flex gap-2">
              {([['identity', t('identities')], ['ego', 'E.G.O']] as [IncludeType, string][]).map(([type, label]) => {
                const active = include.has(type)
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleInclude(type)}
                    className={`flex-1 cursor-pointer rounded border py-2 text-xs font-medium transition duration-150 ${active
                      ? 'border-[var(--border-gold)] bg-[var(--gold)]/15 text-[var(--gold-light)]'
                      : 'border-white/[0.08] bg-white/[0.03] text-[var(--text-muted)]'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className={SECTION_LABEL}>{t('groupBy')}</span>
            <Dropdown
              value={groupBy}
              options={[
                { value: 'sinner' as GroupBy, label: t('groupBySinner') },
                { value: 'keyword' as GroupBy, label: t('groupByKeyword') },
              ]}
              onChange={setGroupBy}
              prefix={`${t('groupBy')}:`}
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/[0.06] px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" className="flex-1" icon={Download} loading={generating} disabled={!canConfirm} onClick={() => onConfirm({ include, groupBy })}>
            {generating ? t('generatingImage') : t('download')}
          </Button>
        </div>
      </div>
    </BaseModal>
  )
}
