'use client'

import { useLocale, useTranslations } from 'next-intl'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { FusionGuide, FusionReason } from '@/lib/planner/assist-gift-guide'
import type { FusionResult } from '@/lib/planner/fusion'
import type { GiftData } from '@/lib/planner/types'

const REASON_LABEL: Partial<Record<FusionReason, string>> = { final: 'fusionReasonFinal', material: 'fusionReasonMaterial', keyword: 'deckKeyword' }

/**
 * Fusions held gifts can make, in fusionGuide's order with a tag for why each leads, then final gifts one material
 * short (the missing one dimmed). Shared by the run overview and the PiP fusion screen.
 */
export default function FusionGuideList({ guide, onCraft }: { guide: FusionGuide; onCraft?: (fusion: FusionResult) => void }) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const name = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const icon = (gift: GiftData, size: number, dim = false) => <span key={gift.game_id} className={`shrink-0 ${dim ? 'opacity-35' : ''}`} style={{ width: size }} title={name(gift)}>
    <GiftArtwork gift={gift} displayName={name(gift)} sizes={`${size}px`} /></span>
  const row = (fusion: FusionResult, tag: string | null, missing: GiftData[] = [], craft = false) => <li key={fusion.recipe.id} data-fusion-result={fusion.result?.game_id}
    className="flex items-center gap-1.5">
    <span className="flex shrink-0 gap-0.5">{fusion.materials.map(material => icon(material, 28, missing.includes(material)))}</span>
    <span aria-hidden="true" className="text-xs text-[var(--text-muted)]">→</span>
    {fusion.result && <span className="flex min-w-0 items-center gap-1.5">{icon(fusion.result, 32)}
      <span className="min-w-0"><span className="block truncate text-xs text-[var(--text-primary)]">{name(fusion.result)}</span>
        {tag && <span className="block text-[0.625rem] font-semibold text-[var(--gold-light)]">{tag}</span>}</span></span>}
    {craft && onCraft && <button type="button" onClick={() => onCraft(fusion)}
      className="ml-auto min-h-8 shrink-0 rounded-md bg-[rgba(200,144,10,0.2)] px-2.5 text-xs font-semibold text-[var(--gold-light)] hover:bg-[rgba(200,144,10,0.3)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
      {t('craft')}</button>}
  </li>
  return <div className="space-y-3">
    {guide.ready.length > 0 && <ul className="space-y-2" data-fusion-ready>
      {guide.ready.map(({ fusion, reason }) => row(fusion, REASON_LABEL[reason] ? t(REASON_LABEL[reason]!) : null, [], true))}</ul>}
    {guide.nearly.length > 0 && <div data-fusion-nearly>
      <h3 className="mb-1.5 text-[0.6875rem] font-bold text-[var(--text-secondary)]">{t('fusionNearly')}</h3>
      <ul className="space-y-2">{guide.nearly.map(({ fusion, missing }) => row(fusion, t('fusionReasonFinal'), missing))}</ul>
    </div>}
  </div>
}
