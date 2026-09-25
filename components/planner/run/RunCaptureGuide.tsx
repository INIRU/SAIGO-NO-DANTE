'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { MonitorUp } from 'lucide-react'

/** Where the callouts sit on the original 1919×1079 game screenshot, as percentages of the image. */
export const CAPTURE_GUIDE_CALLOUTS = {
  before: { step: 1, left: 69.3, top: 18.9, width: 25.6, height: 5.9 },
  enter: { step: 4, left: 79, top: 62.6, width: 15.4, height: 12.4 },
} as const

/**
 * Screen-connection order before entering the Mirror Dungeon: the real pre-entry game screen with its '탐사 전' status
 * and '입장' button marked, next to the four steps. This setup screen is step 2.
 */
export default function RunCaptureGuide() {
  const t = useTranslations('planner.run')
  const steps = [t('captureGuideStep1'), t('captureGuideStep2', { start: t('start') }), t('captureGuideStep3', { connect: t('screenPreview') }),
    t('captureGuideStep4')]
  return <section aria-labelledby="run-capture-guide" data-capture-guide
    className="@container min-w-0 lg:flex lg:h-full lg:flex-col">
    <h2 id="run-capture-guide" className="mb-3 font-[family-name:var(--font-heading)] text-lg text-[var(--gold-light)]">{t('captureGuideTitle')}</h2>
    <div className="grid min-w-0 gap-4 lg:min-h-0 lg:flex-1 lg:grid-rows-[auto_minmax(0,1fr)] @[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] @[64rem]:items-start">
      <ol className="min-w-0 space-y-2">
        {steps.map((step, index) => {
          const here = index === 1
          return <li key={index} aria-current={here ? 'step' : undefined}
            className={`grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 rounded-md px-2 py-2 ${here ? 'border border-[var(--border-gold)] bg-[var(--bg-elevated)]' : 'border border-transparent'}`}>
            <span aria-hidden="true" className={`grid h-8 w-8 place-items-center rounded-full border font-[family-name:var(--font-title)] text-base leading-none ${here ? 'border-[var(--gold-light)] bg-[var(--gold)] text-[var(--bg-deep)]' : 'border-[var(--border-gold)] text-[var(--gold)]'}`}>{index + 1}</span>
            <span className="min-w-0">
              <span className={`block break-keep text-base leading-7 ${here ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {step}{index === 2 && <MonitorUp aria-hidden="true" className="ml-1 inline align-[-0.125rem] text-[var(--gold-light)]" size={16} />}
              </span>
            </span>
          </li>
        })}
      </ol>
      <figure className="min-w-0 lg:min-h-0 lg:[container-type:size]">
        <div className="relative w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-deep)] lg:w-[min(100cqw,calc(100cqh*1919/1079))]" style={{ aspectRatio: '1919 / 1079' }}>
          <Image src="/assets/guides/mirror-dungeon-pre-entry.webp" alt={t('captureGuideImageAlt')} fill loading="eager" sizes="(min-width: 1024px) 52rem, 100vw"
            className="object-contain" />
          <ul className="absolute inset-0">
            {(['before', 'enter'] as const).map(key => {
              const spot = CAPTURE_GUIDE_CALLOUTS[key]
              return <li key={key} data-guide-callout={key} className="absolute rounded-[0.25rem] border-2 border-[var(--gold-light)] shadow-[0_0_0_2px_rgba(0,0,0,0.65),0_0_1rem_rgba(232,176,48,0.55)]"
                style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, height: `${spot.height}%` }}>
                <span className={`absolute right-0 flex items-center gap-1 whitespace-nowrap rounded bg-[var(--bg-deep)] px-1.5 py-0.5 text-xs font-bold text-[var(--gold-light)] ring-1 ring-[var(--gold)] ${key === 'before' ? 'top-[calc(100%+0.3rem)]' : 'bottom-[calc(100%+0.3rem)]'}`}>
                  <span aria-hidden="true" className="font-[family-name:var(--font-title)]">{spot.step}</span>
                  {t(key === 'before' ? 'captureGuideCalloutBefore' : 'captureGuideCalloutEnter')}
                </span>
              </li>
            })}
          </ul>
        </div>
      </figure>
    </div>
  </section>
}
