'use client'

import Image from 'next/image'
import { Passive, SIN_COLORS, SIN_KR_TO_EN, getSinIconUrl, STORAGE_BASE } from '@/lib/data/sinners'
import SkillDescription from '@/components/skill/SkillDescription'
import type { PassiveDiff } from '@/lib/utils/uptie-diff'
import { useTranslations, useLocale } from 'next-intl'

interface IdentityPassivesTabProps {
  filteredPassives: Passive[]
  sinColor: string
  skillNameColors: Record<string, string>
  allowedKeywords?: Set<string>
  passiveDiffs?: Map<string, PassiveDiff>
  newPassives?: Passive[]
}

export default function IdentityPassivesTab({ filteredPassives, sinColor, skillNameColors, allowedKeywords, passiveDiffs, newPassives }: IdentityPassivesTabProps) {
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
                {passiveDiffs?.get(p.id)?.sin_count && (
                  <span style={{ color: '#e8b030', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.25rem' }}>
                    {'\u2192'}x{passiveDiffs.get(p.id)!.sin_count!.to}
                  </span>
                )}
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
        {p.description && (
          <SkillDescription
            description={localPassiveDesc(p)}
            accentColor={primaryColor}
            variant="detail"
            skillNameColors={skillNameColors}
            showCoinBadges={false}
            allowedKeywords={allowedKeywords}
            level4Desc={passiveDiffs?.get(p.id)?.hasDescDiff ? (() => {
              const pd = passiveDiffs.get(p.id)!
              return locale === 'en' && pd.level4Desc_en ? pd.level4Desc_en
                : locale === 'ja' && pd.level4Desc_jp ? pd.level4Desc_jp
                : pd.level4Desc
            })() : undefined}
          />
        )}
      </div>
    )
  }

  const SectionBadge = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-3 my-4">
      {/* 좌측 장식선 */}
      <div className="flex-1" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, var(--gold-dim) 100%)',
      }} />
      <span
        className="text-sm font-bold tracking-widest"
        style={{
          color: 'var(--gold)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.25em',
          textShadow: '0 0 12px rgba(200,144,10,0.15)',
        }}
      >
        {children}
      </span>
      {/* 우측 장식선 */}
      <div className="flex-1" style={{
        height: '1px',
        background: 'linear-gradient(90deg, var(--gold-dim) 0%, transparent 100%)',
      }} />
    </div>
  )

  return (
    <div className="card p-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>

      {battlePassives.length > 0 && (
        <div className="mb-6">
          <SectionBadge>{t('identity.passives.battle')}</SectionBadge>
          <div className="divide-y divide-white/5 space-y-4">
            {battlePassives.map(renderPassive)}
          </div>
        </div>
      )}

      {supportPassives.length > 0 && (
        <div>
          <SectionBadge>{t('identity.passives.support')}</SectionBadge>
          <div className="divide-y divide-white/5 space-y-4">
            {supportPassives.map(renderPassive)}
          </div>
        </div>
      )}

      {/* 4동기화 전용 패시브 (dimmed + lock) */}
      {newPassives && newPassives.length > 0 && (
        <div className="mt-4 space-y-2">
          {newPassives.map(p => {
            const pColor = p.sin_affinity ? SIN_COLORS[SIN_KR_TO_EN[p.sin_affinity] || p.sin_affinity] || sinColor : sinColor
            return (
              <div
                key={p.id}
                className="relative p-3 rounded"
                style={{ opacity: 0.35, pointerEvents: 'none', background: `${pColor}08`, border: `1px solid ${pColor}15` }}
              >
                <div className="absolute top-2 left-2 z-10">
                  <Image
                    src={`${STORAGE_BASE}/icons/ui/lock.webp`}
                    alt=""
                    width={118}
                    height={157}
                    style={{ width: '0.75rem', height: 'auto', filter: 'brightness(0.7)' }}
                  />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: pColor }}>{localPassiveName(p)}</span>
                  <span className="text-xs" style={{ color: '#555' }}>{p.passive_type === 'battle' ? t('identity.passives.typeBattle') : t('identity.passives.typeSupport')}</span>
                </div>
                <SkillDescription
                  description={localPassiveDesc(p)}
                  accentColor={pColor}
                  variant="detail"
                  skillNameColors={skillNameColors}
                  showCoinBadges={false}
                  allowedKeywords={allowedKeywords}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
