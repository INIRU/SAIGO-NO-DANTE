'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import SkillDescription from '@/components/skill/SkillDescription'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { useKeywordData } from '@/components/sinners/KeywordTooltip'
import { useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import {
  RARITY_ICON_MAP,
  SIN_COLORS,
  SIN_KR_TO_EN,
  getSinIconUrl,
  getSinnerLogoUrl,
  type SinType,
} from '@/lib/data/sinners'
import { STORAGE_BASE } from '@/lib/constants/game'
import { normalizeThemeKeyword, THEME_KEYWORDS } from '@/lib/constants/keywords'
import type { SupportedLang } from '@/lib/i18n/types'
import {
  localizeEgoName,
  localizeIdentityName,
  localizePassiveDescription,
  localizePassiveName,
  localizeSkillName,
  portraitUrl,
  type EgoEntry,
  type IdentitySlot,
} from './DeckIdentityCard'

type PreviewTab = 'skills' | 'passives' | 'ego'

type DeckIdentityPreviewModalProps = {
  open: boolean
  slot: IdentitySlot | null
  egos?: EgoEntry[]
  keywordMeta?: Record<string, { description: string }>
  onEgoClick?: (egoId: string) => void
  onClose: () => void
}

type PreviewPassive = NonNullable<IdentitySlot['identities']>['passives'][number] & {
  id?: string
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
}

type PreviewIdentity = NonNullable<IdentitySlot['identities']>

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

const STAT_ICON_URL: Record<string, string> = {
  hp: `${STORAGE_BASE}/icons/stats/health.webp`,
  spd: `${STORAGE_BASE}/icons/stats/speed.webp`,
  def: `${STORAGE_BASE}/icons/stats/defense.webp`,
}

const RES_ATK_ICON: Record<string, string> = {
  '참': `${STORAGE_BASE}/icons/stats/slash.webp`,
  '관': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  '타': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

const RES_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  '효율': { color: '#e06070', bg: 'rgba(200,64,80,0.12)', border: 'rgba(200,64,80,0.3)' },
  '취약': { color: '#e06070', bg: 'rgba(200,64,80,0.12)', border: 'rgba(200,64,80,0.3)' },
  '보통': { color: '#8c8170', bg: 'rgba(90,84,74,0.14)', border: 'rgba(110,102,88,0.22)' },
  '내성': { color: '#4898b0', bg: 'rgba(52,120,160,0.12)', border: 'rgba(52,120,160,0.3)' },
  '견딤': { color: '#4898b0', bg: 'rgba(52,120,160,0.12)', border: 'rgba(52,120,160,0.3)' },
  '무효': { color: '#506174', bg: 'rgba(20,28,36,0.3)', border: 'rgba(40,56,72,0.2)' },
}

function resistanceMessageKey(value: string): 'fatal' | 'normal' | 'endured' | 'ineffective' | 'nullified' {
  if (value === '효율' || value === '취약') return 'fatal'
  if (value === '내성') return 'endured'
  if (value === '견딤') return 'ineffective'
  if (value === '무효') return 'nullified'
  return 'normal'
}

function sinColor(sin: string | null | undefined): string {
  if (!sin) return '#c8900a'
  const en = SIN_KR_TO_EN[sin] ?? sin
  return SIN_COLORS[en as SinType] ?? '#c8900a'
}

function sinTypesFromPassive(passiveSin: string | null | undefined): SinType[] {
  if (!passiveSin) return []
  return passiveSin
    .split(',')
    .map(item => item.trim())
    .map(item => SIN_KR_TO_EN[item] ?? (SIN_COLORS[item as SinType] ? item as SinType : null))
    .filter((item): item is SinType => Boolean(item))
}

function dedupeSkills(identity: NonNullable<IdentitySlot['identities']>) {
  const best = new Map<string, NonNullable<IdentitySlot['identities']>['skills'][number]>()
  for (const skill of identity.skills ?? []) {
    const key = `${skill.skill_order}:${skill.variant_order ?? 0}`
    const existing = best.get(key)
    if (!existing || (skill.uptie_level ?? 3) > (existing.uptie_level ?? 3)) best.set(key, skill)
  }
  return [...best.values()].sort((a, b) => a.skill_order - b.skill_order || (a.variant_order ?? 0) - (b.variant_order ?? 0))
}

function dedupePassives(identity: NonNullable<IdentitySlot['identities']>) {
  const best = new Map<string, NonNullable<IdentitySlot['identities']>['passives'][number]>()
  for (const passive of identity.passives ?? []) {
    const key = `${passive.passive_type}:${passive.passive_order}`
    const existing = best.get(key)
    if (!existing || (passive.uptie_level ?? 3) > (existing.uptie_level ?? 3)) best.set(key, passive)
  }
  return [...best.values()].sort((a, b) => a.passive_order - b.passive_order)
}

export default function DeckIdentityPreviewModal({
  open,
  slot,
  egos = [],
  keywordMeta,
  onEgoClick,
  onClose,
}: DeckIdentityPreviewModalProps) {
  const reduceMotion = useReducedMotion()
  const t = useTranslations('decks.identityPreview')
  const rootT = useTranslations()
  const lang = useLocale()
  const supportedLang = lang as SupportedLang
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const [activeTab, setActiveTab] = useState<PreviewTab>('skills')
  const identity = slot?.identities ?? null

  useEffect(() => {
    if (!open || !identity) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [identity, onClose, open])

  useEffect(() => {
    if (open) setActiveTab('skills')
  }, [identity?.id, open])

  if (!identity || !slot) return null

  const sortedSkills = dedupeSkills(identity)
  const sortedPassives = dedupePassives(identity)
  const identityName = localizeIdentityName(identity, lang)
  const skillNameColors: Record<string, string> = {}
  for (const skill of sortedSkills) {
    const color = SIN_COLORS[skill.sin_affinity as SinType] || '#cccccc'
    skillNameColors[skill.name] = color
    skillNameColors[localizeSkillName(skill, lang)] = color
  }
  const allowedKeywords = new Set(identity.keywords ?? [])
  const portrait = portraitUrl(identity.sinner_id, identity.folder_name, identity.game_id, slot.gacksung)
  const sinnerName = rootT(`sinner.${identity.sinner_id}`)
  const primaryColor = sinColor(sortedSkills.find(skill => skill.skill_order === 1)?.sin_affinity)
  const themeKws = [...new Set((identity.keywords ?? []).map(normalizeThemeKeyword).filter(kw => THEME_KW_SET.has(kw)))]
  const tabs: { key: PreviewTab; label: string; count: number }[] = [
    { key: 'skills', label: t('skills'), count: sortedSkills.length },
    { key: 'passives', label: t('passives'), count: sortedPassives.length },
    { key: 'ego', label: t('ego'), count: egos.length },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/72 p-2 backdrop-blur-sm sm:items-center sm:p-4 md:p-6"
          style={{
            paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-identity-preview-title"
            className="flex h-[calc(100dvh-1rem)] w-full max-w-[80rem] flex-col overflow-hidden rounded-t-2xl sm:h-[82dvh] sm:rounded-xl"
            style={{
              background: '#0d0b08',
              border: '1px solid rgba(232,176,48,0.18)',
              boxShadow: '0 1.5rem 4rem rgba(0,0,0,0.62)',
            }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.975 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={event => event.stopPropagation()}
          >
            <header
              className="flex min-h-[3rem] shrink-0 items-center gap-3 px-3 sm:px-4"
              style={{
                background: '#17120d',
                borderBottom: '1px solid rgba(232,176,48,0.14)',
              }}
            >
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="h-3 w-3 rounded-full" style={{ background: '#d75f57' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#d6a33d' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#6a9f58' }} />
              </div>
              <div className="min-w-0 flex-1 cursor-default select-none text-center sm:text-left">
                <h2
                  id="deck-identity-preview-title"
                  className="truncate"
                  style={{ color: '#d7c7aa', fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', lineHeight: 1.3, fontWeight: 700 }}
                >
                  {slot.slot_order < 99 ? t('formationSlot', { order: slot.slot_order + 1 }) : t('backupSlot')} / {identityName}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="inline-flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-md transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17120d]"
                style={{ color: '#d8c8aa' }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4"
              style={{ background: 'linear-gradient(180deg, rgba(13,11,8,0.96), rgba(5,4,3,0.98))' }}
            >
              <div className="mx-auto grid w-full max-w-[72rem] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
                <section className="min-w-0 self-start space-y-3">
                  <div
                    className="overflow-hidden rounded-lg"
                    style={{ background: '#120f0b', border: '1px solid rgba(232,176,48,0.16)' }}
                  >
                    <div className="relative aspect-[4/5] min-h-[22rem] overflow-hidden bg-[#090705] sm:aspect-[5/4] lg:aspect-auto lg:h-[34rem]">
                      {portrait ? (
                        <Image
                          src={portrait}
                          alt={t('portraitAlt', { identity: identityName })}
                          fill
                          sizes="(min-width: 1024px) 20rem, 100vw"
                          className="object-cover"
                          style={{ objectPosition: 'center top' }}
                          priority
                        />
                      ) : (
                        <div className="h-full w-full" style={{ background: '#090705' }} />
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-4" style={{ background: 'linear-gradient(0deg, rgba(5,4,3,0.95), rgba(5,4,3,0))' }}>
                        <div className="flex items-center gap-2">
                          <Image src={getSinnerLogoUrl(identity.sinner_id)} alt="" width={28} height={28} style={{ height: '1.75rem', width: 'auto', opacity: 0.72 }} />
                          <span style={{ color: '#d5c0a0', fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', fontWeight: 700 }}>
                            {t('sinnerLabel', { sinner: sinnerName })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <IdentitySummaryCard
                    identity={identity}
                    themeKws={themeKws}
                    keywordMeta={keywordMeta}
                    getIconUrl={getIconUrl}
                    previewLabel={t('preview')}
                    rarityLabel={(rarity) => t('rarity', { rarity })}
                    localizeKeyword={(keyword) => localizeDeckKeyword(keyword, keywords[keyword], supportedLang)}
                    resistanceLabel={(value) => t(`resistance.${resistanceMessageKey(value)}`)}
                    identityName={identityName}
                  />
                </section>

                <section className="min-w-0">
                  <div className="rounded-lg" style={{ background: 'rgba(10,8,6,0.88)', border: '1px solid rgba(232,176,48,0.14)' }}>
                    <div className="flex flex-wrap" style={{ borderBottom: '1px solid rgba(232,176,48,0.14)' }}>
                      {tabs.map(tab => {
                        const isActive = activeTab === tab.key
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className="min-h-[2.75rem] min-w-[6.5rem] flex-1 px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-inset"
                            style={{
                              background: isActive ? `${primaryColor}16` : 'transparent',
                              color: isActive ? '#eadfc8' : '#8d806d',
                              borderBottom: `2px solid ${isActive ? primaryColor : 'transparent'}`,
                              fontFamily: 'var(--font-heading)',
                              fontSize: '0.9375rem',
                            }}
                          >
                            {tab.label}
                            <span className="ml-2" style={{ color: isActive ? primaryColor : '#6d6252', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                              {tab.count}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {activeTab === 'skills' && (
                      <div className="grid gap-3 p-3 xl:grid-cols-2">
                        {sortedSkills.length > 0 ? sortedSkills.map(skill => (
                          <IdentitySkillFrameCard
                            key={skill.id}
                            skill={skill}
                            skills={sortedSkills}
                            identity={identity}
                            lang={lang}
                            size="4rem"
                            className="rounded p-3"
                          />
                        )) : (
                          <EmptySection label={t('noSkills')} />
                        )}
                      </div>
                    )}

                    {activeTab === 'passives' && (
                      <div className="p-3 sm:p-4">
                        {sortedPassives.length > 0 ? (
                          <PreviewPassives
                            passives={sortedPassives}
                            fallbackColor={primaryColor}
                            locale={lang}
                            skillNameColors={skillNameColors}
                            allowedKeywords={allowedKeywords}
                          />
                        ) : (
                          <EmptySection label={t('noPassives')} />
                        )}
                      </div>
                    )}

                    {activeTab === 'ego' && (
                      <div className="grid grid-cols-2 justify-items-center gap-x-2 gap-y-6 p-3 sm:grid-cols-3 sm:gap-x-3 sm:gap-y-7">
                        {egos.length > 0 ? egos.map(({ grade, ego }) => (
                          <EgoDisplayCard
                            key={ego.id}
                            ego={{
                              grade: ego.grade ?? grade,
                              image_url: ego.image_url,
                              sin_affinity: ego.sin_affinity,
                            }}
                            lang={supportedLang}
                            name={localizeEgoName(ego, lang)}
                            onClick={() => onEgoClick?.(ego.id)}
                            sinnerId={ego.sinner_id || identity.sinner_id}
                          />
                        )) : (
                          <EmptySection label={t('noEgo')} />
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function IdentitySummaryCard({
  identity,
  themeKws,
  keywordMeta,
  getIconUrl,
  previewLabel,
  rarityLabel,
  localizeKeyword,
  resistanceLabel,
  identityName,
}: {
  identity: PreviewIdentity
  themeKws: string[]
  keywordMeta?: Record<string, { description: string }>
  getIconUrl: (keyword: string) => string | null
  previewLabel: string
  rarityLabel: (rarity: number) => string
  localizeKeyword: (keyword: string) => string
  resistanceLabel: (value: string) => string
  identityName: string
}) {
  return (
    <div className="rounded-lg p-3 sm:p-4" style={{ background: 'rgba(26,21,16,0.84)', border: '1px solid rgba(232,176,48,0.14)' }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p style={{ color: '#8a7654', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', letterSpacing: '0.06em' }}>
            {previewLabel}
          </p>
          <h3 className="mt-1 break-keep font-serif text-[1.2rem] leading-tight sm:text-[1.35rem]" style={{ color: '#eee4cf', fontWeight: 400 }}>
            {identityName}
          </h3>
        </div>
        {RARITY_ICON_MAP[identity.rarity] ? (
          <Image
            src={RARITY_ICON_MAP[identity.rarity]}
            alt={rarityLabel(identity.rarity)}
            width={identity.rarity === 1 ? 24 : identity.rarity === 2 ? 44 : 54}
            height={20}
            style={{ height: '1.25rem', width: 'auto', opacity: 0.95, flexShrink: 0 }}
          />
        ) : (
          <span className="rounded px-2 py-1" style={{ color: '#c8900a', border: '1px solid rgba(200,144,10,0.32)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
            {rarityLabel(identity.rarity)}
          </span>
        )}
      </div>

      {themeKws.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {themeKws.map(kw => {
            const iconUrl = getIconUrl(kw)
            const desc = keywordMeta?.[kw]?.description
            return (
              <span
                key={kw}
                title={desc}
                className="inline-flex min-h-[2rem] items-center gap-1 rounded px-2"
                style={{ background: 'rgba(120,76,28,0.13)', color: '#b5965a', border: '1px solid rgba(120,76,28,0.24)', fontFamily: 'var(--font-heading)', fontSize: '0.875rem' }}
              >
                {iconUrl && <Image src={iconUrl} alt="" width={18} height={18} />}
                {localizeKeyword(kw)}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {identity.hp != null && <StatBox icon={STAT_ICON_URL.hp} label="HP" value={identity.hp} color="#cc5050" />}
        {identity.speed_min != null && identity.speed_max != null && <StatBox icon={STAT_ICON_URL.spd} label="SPD" value={`${identity.speed_min}-${identity.speed_max}`} color="#88a830" />}
        {identity.def_level != null && <StatBox icon={STAT_ICON_URL.def} label="DEF" value={identity.def_level} color="#4898b0" />}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {([
          { label: 'slash', iconKey: '참', val: identity.slash_res },
          { label: 'pierce', iconKey: '관', val: identity.pierce_res },
          { label: 'blunt', iconKey: '타', val: identity.blunt_res },
        ] as { label: string; iconKey: string; val: string | null }[]).map(({ label, iconKey, val }) => {
          if (!val) return null
          const st = RES_STYLE[val] ?? RES_STYLE['보통']
          return (
            <span key={label} className="inline-flex min-h-[2rem] items-center gap-1 rounded px-2" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
              <Image src={RES_ATK_ICON[iconKey]} alt={localizeKeyword(label)} width={16} height={16} style={{ opacity: 0.78 }} />
              {resistanceLabel(val)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function PreviewPassives({
  passives,
  fallbackColor,
  locale,
  skillNameColors,
  allowedKeywords,
}: {
  passives: PreviewPassive[]
  fallbackColor: string
  locale: string
  skillNameColors: Record<string, string>
  allowedKeywords?: Set<string>
}) {
  const t = useTranslations()
  const battlePassives = passives.filter(passive => passive.passive_type === 'battle')
  const supportPassives = passives.filter(passive => passive.passive_type === 'support')

  const renderPassive = (passive: PreviewPassive, index: number) => {
    const sinTypes = sinTypesFromPassive(passive.sin_affinity)
    const passiveColor = sinTypes[0] ? SIN_COLORS[sinTypes[0]] : fallbackColor
    const description = localizePassiveDescription(passive, locale)

    return (
      <div key={passive.id ?? `${passive.passive_type}-${passive.passive_order}-${index}`} className="py-3 first:pt-1 last:pb-1">
        <div className="mb-3 overflow-hidden" style={{ width: 'fit-content', maxWidth: '100%' }}>
          <div
            style={{
              color: '#e8dcc8',
              backgroundImage: `linear-gradient(255deg, transparent 2em, ${passiveColor}30 2em)`,
            }}
          >
            <div
              style={{
                padding: '0.3em 0 0.3em 0.5em',
                backgroundImage: `linear-gradient(290deg, transparent 3em, ${passiveColor}35 3em, ${passiveColor}35 3.2em, transparent 3.2em, transparent 3.4em, ${passiveColor}35 3.4em, ${passiveColor}35 3.6em, transparent 3.6em, transparent 3.8em, ${passiveColor}35 3.8em, ${passiveColor}35 4em, transparent 4em, transparent 4.2em, ${passiveColor}35 4.2em)`,
                textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
              }}
            >
              <span
                className="font-bold whitespace-nowrap"
                style={{
                  color: '#e8dcc8',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.0625rem',
                  fontWeight: 800,
                  paddingRight: '5.5em',
                }}
              >
                {localizePassiveName(passive, locale)}
              </span>
            </div>
          </div>
        </div>

        {(sinTypes.length > 0 || passive.active_cond) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {sinTypes.map((sinType, iconIndex) => (
              <Image
                key={`${sinType}-${iconIndex}`}
                src={getSinIconUrl(sinType)}
                alt=""
                width={28}
                height={28}
                style={{ height: '1.75rem', width: '1.75rem' }}
              />
            ))}
            {passive.sin_count != null && passive.sin_count > 0 && (
              <span
                className="font-bold"
                style={{ color: '#e8dcc8', fontFamily: 'var(--font-heading)', fontSize: '0.9375rem' }}
              >
                x{passive.sin_count}
              </span>
            )}
            {passive.active_cond && (
              <span
                className="font-bold"
                style={{ color: '#e8dcc8', fontFamily: 'var(--font-heading)', fontSize: '0.9375rem' }}
              >
                {passive.active_cond === 'resonance'
                  ? t('identity.passives.resonance')
                  : passive.active_cond === 'stock'
                    ? t('identity.passives.stock')
                    : passive.active_cond}
              </span>
            )}
          </div>
        )}

        {description && (
          <SkillDescription
            description={description}
            accentColor={passiveColor}
            variant="detail"
            skillNameColors={skillNameColors}
            showCoinBadges={false}
            allowedKeywords={allowedKeywords}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      {battlePassives.length > 0 && (
        <section className="mb-5">
          <PassiveSectionBadge>{t('identity.passives.battle')}</PassiveSectionBadge>
          <div className="space-y-3 divide-y divide-white/5">
            {battlePassives.map(renderPassive)}
          </div>
        </section>
      )}

      {supportPassives.length > 0 && (
        <section>
          <PassiveSectionBadge>{t('identity.passives.support')}</PassiveSectionBadge>
          <div className="space-y-3 divide-y divide-white/5">
            {supportPassives.map(renderPassive)}
          </div>
        </section>
      )}
    </div>
  )
}

function PassiveSectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <div
        className="flex-1"
        style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, var(--gold-dim) 100%)' }}
      />
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
      <div
        className="flex-1"
        style={{ height: '1px', background: 'linear-gradient(90deg, var(--gold-dim) 0%, transparent 100%)' }}
      />
    </div>
  )
}

function StatBox({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="flex min-h-[3rem] min-w-[8rem] flex-1 items-center gap-2 rounded px-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.055)' }}>
      <Image src={icon} alt={label} width={22} height={22} style={{ opacity: 0.88, flexShrink: 0 }} />
      <span>
        <span className="block" style={{ color: '#716655', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{label}</span>
        <strong style={{ color, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>{value}</strong>
      </span>
    </div>
  )
}

function EmptySection({ label }: { label: string }) {
  return (
    <p className="rounded p-4" style={{ color: '#8a8095', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9375rem' }}>
      {label}
    </p>
  )
}
