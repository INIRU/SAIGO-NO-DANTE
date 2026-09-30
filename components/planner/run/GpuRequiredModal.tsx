'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy, RotateCw } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { graphicsSettingsUrl, type GpuBlock } from '@/lib/vision/device'

/** Gold ring with its step number, as on the capture guide's screenshot callouts. */
function Callout({ step, className = '', children }: { step: number; className?: string; children: ReactNode }) {
  return <span data-gpu-callout={step} className={`relative inline-flex rounded-md ring-2 ring-[var(--gold-light)] ring-offset-2 ring-offset-[var(--bg-deep)] ${className}`}>
    {children}
    <span className="absolute -left-2.5 -top-2.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--gold)] font-[family-name:var(--font-title)] text-xs leading-none text-[var(--bg-deep)]">{step}</span>
  </span>
}

/**
 * Why screen recognition refused to start (no WebGPU) and how to fix it. With no GPU adapter, the browser's settings
 * page is drawn with the address, the graphics acceleration switch and the relaunch button marked in the order to use them.
 */
export default function GpuRequiredModal({ block, open, onClose, onReconnect }: {
  block: GpuBlock
  open: boolean
  onClose: () => void
  onReconnect: () => void
}) {
  const t = useTranslations('planner.run')
  const tCommon = useTranslations('common')
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('gpuHelpCopied'))
    } catch {
      toast.error(t('gpuHelpCopyFailed'))
    }
  }
  const address = open ? graphicsSettingsUrl(navigator.userAgent) : ''
  const label = t('gpuHelpSettingsLabel'), relaunch = t('gpuHelpRelaunch')
  const copyButton = (text: string, name: string) => <button type="button" onClick={() => void copy(text)}
    className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--border-gold)] px-3 text-xs font-semibold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)]">
    <Copy aria-hidden="true" size={13} /> {name}
  </button>
  const steps: ReactNode[] = block === 'unavailable'
    ? [<>{t('gpuHelpStepAddress')}<br />{copyButton(address, t('gpuHelpCopyAddress'))}</>, t('gpuHelpStepToggle', { label }), t('gpuHelpStepRelaunch', { relaunch })]
    : block === 'unsupported'
      ? [t('gpuHelpStepInstall'), <>{t('gpuHelpStepOpenHere')}<br />{copyButton(open ? location.href : '', t('gpuHelpCopyLink'))}</>]
      : [t('gpuHelpStepDriver'), t('gpuHelpStepRestart'), t('gpuHelpStepReconnect')]
  return <BaseModal open={open} onClose={onClose} title={t(`gpuHelpTitle_${block}`)} maxWidth="32rem" zIndex={9999}>
    <section className="popup-confirm" data-gpu-help={block}>
      <h2>{t(`gpuHelpTitle_${block}`)}</h2>
      <p>{t(block === 'failed' ? 'gpuHelpLeadFailed' : 'gpuHelpLead')}</p>
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => <li key={index} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3">
          <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full border border-[var(--border-gold)] font-[family-name:var(--font-title)] text-base leading-none text-[var(--gold)]">{index + 1}</span>
          <span className="min-w-0 break-keep pt-0.5 text-sm leading-6 text-[var(--text-primary)]">{step}</span>
        </li>)}
      </ol>
      {block === 'unavailable' && <>
        {/* The settings page, drawn: the steps above carry the same information for screen readers. */}
        <figure aria-hidden="true" data-gpu-settings className="mt-5 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-deep)]">
          <div className="border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
            <Callout step={1} className="w-full">
              <span className="block w-full truncate rounded-md bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)]">{address}</span>
            </Callout>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3">
              <span className="min-w-0 flex-1 break-keep text-xs leading-5 text-[var(--text-primary)]">{label}</span>
              <Callout step={3}>
                <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-[var(--border-gold)] px-2.5 text-xs font-semibold text-[var(--gold-light)]">
                  <RotateCw size={12} /> {relaunch}
                </span>
              </Callout>
              <Callout step={2} className="rounded-full">
                <span className="relative block h-5 w-9 rounded-full bg-[var(--gold)]">
                  <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--bg-deep)]" />
                </span>
              </Callout>
            </div>
          </div>
        </figure>
        <p className="mt-3 !text-xs !leading-5">{t('gpuHelpDriver')}</p>
      </>}
      <div className="popup-actions">
        <button type="button" onClick={onClose}>{tCommon('close')}</button>
        {block === 'failed' && <button type="button" className="popup-primary" onClick={onReconnect}>{t('gpuHelpReconnect')}</button>}
      </div>
    </section>
  </BaseModal>
}
