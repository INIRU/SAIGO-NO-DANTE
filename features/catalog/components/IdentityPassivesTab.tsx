'use client'

import { Passive, SIN_COLORS } from '@/lib/data/sinners'
import { passiveRequirements } from '@/lib/planner/passives'
import { PassiveNameLabel, PassiveRequirements } from '@/features/catalog/components/PassiveParts'
import SkillDescription from '@/features/catalog/components/SkillDescription'
import { UptieChangePanel } from '@/features/catalog/components/UptieChanges'
import { diffDescriptionLines, type PassiveDiff } from '@/lib/utils/uptie-diff'
import { useTranslations, useLocale } from 'next-intl'

interface IdentityPassivesTabProps {
  filteredPassives: Passive[]
  sinColor: string
  skillNameColors: Record<string, string>
  allowedKeywords?: ReadonlySet<string>
  passiveDiffs?: Map<string, PassiveDiff>
  newPassives?: Passive[]
  /** Next uptie level with data; diffs above compare against it. */
  nextLevel?: number | null
}

type PassiveWithFlavor = Passive & {
  flavor?: string | null
  flavor_en?: string | null
  flavor_jp?: string | null
}

function localPassiveFlavor(passive: Passive, locale: string): string | null | undefined {
  const p = passive as PassiveWithFlavor
  if (locale === 'en') return p.flavor_en || p.flavor
  if (locale === 'ja') return p.flavor_jp || p.flavor
  return p.flavor
}

export default function IdentityPassivesTab({ filteredPassives, sinColor, skillNameColors, allowedKeywords, passiveDiffs, newPassives, nextLevel }: IdentityPassivesTabProps) {
  const t = useTranslations()
  const locale = useLocale()
  const localPassiveName = (p: Passive) =>
    locale === 'en' && p.name_en ? p.name_en : locale === 'ja' && p.name_jp ? p.name_jp : p.name
  const localPassiveDesc = (p: Passive) =>
    locale === 'en' && p.description_en ? p.description_en : locale === 'ja' && p.description_jp ? p.description_jp : p.description

  if (filteredPassives.length === 0) {
    return (
      <div
        className="card p-8 text-center"
        style={{ color: '#999', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
      >
        <p className="font-serif text-lg">
          {t('identity.passives.preparing')}
        </p>
      </div>
    )
  }

  const battlePassives = filteredPassives.filter(p => p.passive_type === 'battle')
  const supportPassives = filteredPassives.filter(p => p.passive_type === 'support')

  const renderPassive = (p: Passive) => {
    const requirements = passiveRequirements(p)
    const primaryColor = requirements[0] ? SIN_COLORS[requirements[0].sin] : '#cccccc'
    const passiveDescription = localPassiveDesc(p)
    const passiveFlavor = localPassiveFlavor(p, locale)
    const diff = passiveDiffs?.get(p.id)

    return (
      <div key={p.id} className="py-2">
        <PassiveNameLabel>{localPassiveName(p)}</PassiveNameLabel>
        <PassiveRequirements
          requirements={requirements}
          condition={p.active_cond === 'resonance' ? t('identity.passives.resonance') : p.active_cond === 'stock' ? t('identity.passives.stock') : null}
          sinLabel={sin => t(`sin.${sin}` as Parameters<typeof t>[0])}
        />

        {/* 설명 */}
        {(passiveDescription || passiveFlavor) && (
          <SkillDescription
            description={passiveDescription}
            accentColor={primaryColor}
            variant="detail"
            skillNameColors={skillNameColors}
            showCoinBadges={false}
            allowedKeywords={allowedKeywords}
            matchPlainKeywords
            flavorText={passiveFlavor}
          />
        )}
        {diff && nextLevel != null && (
          <UptieChangePanel
            level={nextLevel}
            stats={diff.sin_count ? [{ label: t('identity.uptie.requirement'), diff: diff.sin_count }] : []}
            lines={diffDescriptionLines(passiveDescription || '', localPassiveDesc(diff.next) || '')}
            accentColor={primaryColor}
            skillNameColors={skillNameColors}
            allowedKeywords={allowedKeywords}
            matchPlainKeywords
          />
        )}
      </div>
    )
  }

  const SectionBadge = ({ children }: { children: React.ReactNode }) => (
    <h3 className="mb-3 pb-2" style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', fontSize: '1rem', borderBottom: '1px solid #2e2417' }}>
      {children}
    </h3>
  )

  return (
    <div className="rounded border border-[#2e2417] bg-[#17120c] p-4 sm:p-6">

      {battlePassives.length > 0 && (
        <div className="mb-8 last:mb-0">
          <SectionBadge>{t('identity.passives.battle')}</SectionBadge>
          <div className="divide-y divide-[#2e2417] space-y-4">
            {battlePassives.map(renderPassive)}
          </div>
        </div>
      )}

      {supportPassives.length > 0 && (
        <div>
          <SectionBadge>{t('identity.passives.support')}</SectionBadge>
          <div className="divide-y divide-[#2e2417] space-y-4">
            {supportPassives.map(renderPassive)}
          </div>
        </div>
      )}

      {/* 다음 동기화에서 새로 생기는 패시브 */}
      {nextLevel != null && newPassives?.map(p => (
        <UptieChangePanel
          key={p.id}
          level={nextLevel}
          title={<>
            <span className="text-[var(--text-primary)]">{localPassiveName(p)}</span>
            <span className="text-[var(--text-muted)]">{t('identity.uptie.newPassive')}</span>
            <span className="text-[var(--text-muted)]">{p.passive_type === 'battle' ? t('identity.passives.typeBattle') : t('identity.passives.typeSupport')}</span>
          </>}
          lines={diffDescriptionLines('', localPassiveDesc(p) || '')}
          accentColor={sinColor}
          skillNameColors={skillNameColors}
          allowedKeywords={allowedKeywords}
          matchPlainKeywords
        />
      ))}
    </div>
  )
}
