'use client'

import Image from 'next/image'
import { getDetailStatIconUrl } from '@/lib/utils/images'
import type { Identity } from '@/lib/data/sinners'
import { useTranslations } from 'next-intl'
import { MAX_IDENTITY_LEVEL } from '@/features/catalog/lib/identity-level'
import { MultipliedCount } from '@/features/catalog/components/PassiveParts'

export default function IdentityStatsCard({ identity, level, setLevel }: { identity: Identity; level: number; setLevel: (level: number) => void }) {
  const t = useTranslations()
  const correction = identity.def_level - level
  const thresholds = identity.break_section ?? []
  const markerColors = ['#e4c777', '#e69b86', '#91beb4']
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm text-[var(--gold)]">{t('identity.stats.title')}</h2>
        <label className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
          <span>Lv. <span className="text-2xl text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-excelsior)' }}>{level}</span></span>
          <input type="range" min={1} max={MAX_IDENTITY_LEVEL} value={level} onChange={event => setLevel(Number(event.target.value))} aria-label={t('identity.stats.level')} className="w-32 accent-[var(--gold)]" />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <div className="flex items-center gap-2">
            <Image src={getDetailStatIconUrl('health')} alt="HP" width={24} height={24} />
            <span className="text-4xl tabular-nums text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-excelsior)' }}>{identity.hp}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-7 text-xs text-[var(--text-secondary)]">{t('identity.stats.breakSectionTitle')}</h3>
          <div className="relative h-3 rounded-sm bg-[#a94c48]" role="img" aria-label={thresholds.map(pct => `${pct}% (${Math.floor(identity.hp * pct / 100)} HP)`).join(', ')}>
            {thresholds.map((pct, i) => (
              <div key={i} className="absolute inset-y-0 w-0.5" style={{ left: `${pct}%`, background: markerColors[i % markerColors.length] }}>
                <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs font-semibold tabular-nums" style={{ color: markerColors[i % markerColors.length] }}>{pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[.625rem] text-[var(--text-muted)]"><span>0%</span><span>100%</span></div>
        </div>
      </div>
      {thresholds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
          {thresholds.map((pct, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: markerColors[i % markerColors.length] }} />
              {t('identity.stats.breakPhase', { n: i + 1 })} · {pct}% <span className="tabular-nums text-[var(--text-primary)]">({Math.floor(identity.hp * pct / 100)} HP)</span>
            </span>
          ))}
        </div>
      )}
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
        {[
          { icon: 'speed' as const, label: t('identity.stats.speed'), value: `${identity.speed_min}–${identity.speed_max}` },
          { icon: 'defense' as const, label: t('identity.stats.defLevel'), value: `${identity.def_level}${correction ? ` (${correction > 0 ? '+' : ''}${correction})` : ''}` },
        ].map(stat => (
          <div key={stat.icon} className="flex items-center gap-3">
            <Image src={getDetailStatIconUrl(stat.icon)} alt="" width={24} height={24} />
            <div><dt className="text-xs text-[var(--text-secondary)]">{stat.label}</dt><dd className="mt-1 text-2xl tabular-nums text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-excelsior)' }}>{stat.value}</dd></div>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {([
          { icon: 'slash', label: t('identity.info.slash'), resistance: identity.slash_res },
          { icon: 'pierce', label: t('identity.info.pierce'), resistance: identity.pierce_res },
          { icon: 'blunt', label: t('identity.info.blunt'), resistance: identity.blunt_res },
        ] as const).map(({ icon, label, resistance }) => (
          <div key={icon} className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)]"><Image src={getDetailStatIconUrl(icon)} alt="" width={18} height={18} />{label}</div>
            <div className="mt-2 text-3xl"><MultipliedCount value={resistance === '내성' ? '0.5' : resistance === '취약' ? '2' : '1'} style={{ fontFamily: 'var(--font-excelsior), sans-serif', color: resistance === '취약' ? '#e69b86' : resistance === '내성' ? '#91beb4' : 'var(--text-primary)' }} /></div>
            <div className="mt-0.5 text-[.6875rem] text-[var(--text-secondary)]">{t(resistance === '취약' ? 'identity.resistance.weak' : resistance === '내성' ? 'identity.resistance.resistant' : 'identity.resistance.normal')}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
