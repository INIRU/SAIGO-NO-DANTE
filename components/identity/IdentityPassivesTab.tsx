'use client'

import Image from 'next/image'
import { Passive, SIN_COLORS, SIN_KR_TO_EN, getSinIconUrl } from '@/lib/data/sinners'
import SkillDescription from '@/components/skill/SkillDescription'
import { UptieChangePanel } from '@/components/identity/UptieChanges'
import { diffDescriptionLines, type PassiveDiff } from '@/lib/utils/uptie-diff'
import { useTranslations, useLocale } from 'next-intl'

interface IdentityPassivesTabProps {
  filteredPassives: Passive[]
  sinColor: string
  skillNameColors: Record<string, string>
  allowedKeywords?: Set<string>
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
    const sinNames = p.sin_affinity ? p.sin_affinity.split(', ').map(s => s.trim()) : []
    const sinTypes = sinNames.map(s => SIN_KR_TO_EN[s] ?? (SIN_COLORS[s as keyof typeof SIN_COLORS] ? s : null)).filter(Boolean) as Array<keyof typeof SIN_COLORS>
    const primaryColor = sinTypes[0] ? SIN_COLORS[sinTypes[0]] : '#cccccc'
    const passiveDescription = localPassiveDesc(p)
    const passiveFlavor = localPassiveFlavor(p, locale)
    const diff = passiveDiffs?.get(p.id)

    return (
      <div key={p.id} className="py-2">
        {/* 패시브 이름 배너 */}
        <div className="overflow-hidden mb-3" style={{ width: 'fit-content', maxWidth: '100%' }}>
          <div style={{
            color: '#e8dcc8',
            backgroundImage: `linear-gradient(255deg, transparent 2em, ${primaryColor}30 2em)`,
          }}>
            <div style={{
              padding: '0.3em 0 0.3em 0.5em',
              backgroundImage: `linear-gradient(290deg, transparent 3em, ${primaryColor}35 3em, ${primaryColor}35 3.2em, transparent 3.2em, transparent 3.4em, ${primaryColor}35 3.4em, ${primaryColor}35 3.6em, transparent 3.6em, transparent 3.8em, ${primaryColor}35 3.8em, ${primaryColor}35 4em, transparent 4em, transparent 4.2em, ${primaryColor}35 4.2em)`,
              textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
            }}>
              <span className="font-bold whitespace-nowrap" style={{
                fontSize: '1.0625rem', fontFamily: 'var(--font-heading)', fontWeight: 800,
                paddingRight: '5.5em',
              }}>
                {localPassiveName(p)}
              </span>
            </div>
          </div>
        </div>

        {/* 발동 조건 */}
        {(sinTypes.length > 0 || p.active_cond) && (
          <div className="flex items-center gap-2 mb-3">
            {sinTypes.map((st, i) => (
              <Image
                key={i}
                src={getSinIconUrl(st)}
                alt=""
                width={28}
                height={28}
              />
            ))}
            {p.sin_count != null && p.sin_count > 0 && (
              <span className="font-bold" style={{ color: '#e8dcc8', fontSize: '0.9375rem', fontFamily: 'var(--font-heading)' }}>
                x{p.sin_count}
              </span>
            )}
            {p.active_cond && (
              <span
                className="font-bold"
                style={{ color: '#e8dcc8', fontSize: '0.9375rem', fontFamily: 'var(--font-heading)' }}
              >
                {p.active_cond === 'resonance' ? t('identity.passives.resonance') : p.active_cond === 'stock' ? t('identity.passives.stock') : p.active_cond}
              </span>
            )}
          </div>
        )}

        {/* 설명 */}
        {(passiveDescription || passiveFlavor) && (
          <SkillDescription
            description={passiveDescription}
            accentColor={primaryColor}
            variant="detail"
            skillNameColors={skillNameColors}
            showCoinBadges={false}
            allowedKeywords={allowedKeywords}
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
        />
      ))}
    </div>
  )
}
