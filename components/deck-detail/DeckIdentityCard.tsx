'use client'

import { getEgoGradeBannerUrl } from '@/lib/utils/images'


import { getIdentityPortraitUrl, getDetailStatIconUrl } from '@/lib/utils/images'
import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Link } from '@/lib/i18n/navigation'
import {
  STORAGE_BASE,
  getSinnerLogoUrl,
  GRADE_COLORS,
  RARITY_ICON_MAP,
  SIN_COLORS,
  SIN_KR_TO_EN,
  getSinIconUrl,
  type SinType,
} from '@/lib/data/sinners'
import { useFormatSkillDesc, useKeywordData, useKeywords } from '@/components/sinners/KeywordTooltip'
import IdentitySkillFrameCard from '@/components/identity/IdentitySkillFrameCard'
import { useLocale, useTranslations } from 'next-intl'
import { type SupportedLang } from '@/lib/i18n'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { usePlainGameText } from '@/lib/hooks/usePlainGameText'
import { splitGameTextLines } from '@/lib/game-text/rich-text'
import { useOwnKeywords } from '@/lib/hooks/useOwnKeywords'
import { descriptionTexts } from '@/lib/keywords/own-keywords'
import { passiveRequirements } from '@/lib/planner/passives'
import { MultipliedCount } from '@/components/passive/PassiveParts'

// ── 타입 ──────────────────────────────────────────────────────────────────
export type SkillDetail = {
  image_id?: string | null
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  skill_type: string
  atk_type?: string | null
  sin_affinity: string
  coins: number
  base_power: number
  coin_power: number
  skill_order: number
  atk_weight: number | null
  offense_level: number | null
  description?: string | null
  description_en?: string | null
  description_jp?: string | null
  uptie_level?: number | null
  variant_order?: number | null
}

export type PassiveDetail = {
  name: string
  name_en?: string | null
  name_jp?: string | null
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  sin_requirements?: { sin: string; count: number }[] | null
  active_cond: string | null
  description: string
  description_en?: string | null
  description_jp?: string | null
  passive_order: number
  uptie_level?: number | null
}

export type IdentityDetail = {
  id: string
  sinner_id: string
  folder_name: string | null
  game_id: string | null
  keywords: string[] | null
  skill_keyword_list?: string[] | null
  affiliation?: string | null
  association_list?: string[] | null
  name?: string | null
  name_kr: string
  name_en?: string | null
  name_jp?: string | null
  tier: number
  rarity: number
  hp: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
  skills: SkillDetail[]
  passives: PassiveDetail[]
}

export type IdentitySlot = {
  slot_order: number
  gacksung: boolean
  /** 동기화 1–4 (컬럼이 없던 예전 응답은 비어 있음) */
  uptie?: number | null
  s1_count?: number
  s2_count?: number
  s3_count?: number
  identities: IdentityDetail | null
}

export type EgoEntry = {
  grade: string
  ego: {
    id: string
    name?: string | null
    name_kr: string | null
    name_en?: string | null
    name_jp?: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
  }
}

// ── 상수 ──────────────────────────────────────────────────────────────────
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

const RARITY_COLORS: Record<string, string> = {
  '1성': '#a87340',
  '2성': '#c83030',
  '3성': '#c8900a',
}

const GRADE_ICON_URL: Record<string, string> = {
  ZAYIN: getEgoGradeBannerUrl('ZAYIN'),
  TETH:  getEgoGradeBannerUrl('TETH'),
  HE:    getEgoGradeBannerUrl('HE'),
  WAW:   getEgoGradeBannerUrl('WAW'),
  ALEPH: getEgoGradeBannerUrl('ALEPH'),
}

const STAT_ICON_URL: Record<string, string> = {
  hp:  getDetailStatIconUrl('health'),
  spd: getDetailStatIconUrl('speed'),
  def: getDetailStatIconUrl('defense'),
}

const RES_ATK_ICON: Record<string, string> = {
  '참': getDetailStatIconUrl('slash'),
  '관': getDetailStatIconUrl('pierce'),
  '타': getDetailStatIconUrl('blunt'),
}

const RES_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  '효율': { color: '#e06070', bg: 'rgba(200,64,80,0.12)', border: 'rgba(200,64,80,0.3)' },
  '취약': { color: '#e06070', bg: 'rgba(200,64,80,0.12)', border: 'rgba(200,64,80,0.3)' },
  '보통': { color: 'var(--text-muted)', bg: 'rgba(48,48,64,0.15)', border: 'rgba(80,80,100,0.2)' },
  '내성': { color: '#4898b0', bg: 'rgba(52,120,160,0.12)', border: 'rgba(52,120,160,0.3)' },
  '견딤': { color: '#4898b0', bg: 'rgba(52,120,160,0.12)', border: 'rgba(52,120,160,0.3)' },
  '무효': { color: 'var(--text-muted)', bg: 'rgba(20,28,36,0.3)', border: 'rgba(40,56,72,0.2)' },
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
function sinIconUrl(sin: string): string {
  return getSinIconUrl(sin as SinType)
}

function sinColor(sin: string): string {
  const en = SIN_KR_TO_EN[sin] ?? sin
  return SIN_COLORS[en as SinType] ?? '#cccccc'
}

function resistanceMessageKey(value: string): 'fatal' | 'normal' | 'endured' | 'ineffective' | 'nullified' {
  if (value === '효율' || value === '취약') return 'fatal'
  if (value === '내성') return 'endured'
  if (value === '견딤') return 'ineffective'
  if (value === '무효') return 'nullified'
  return 'normal'
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function localizeIdentityName(
  identity: { name_en?: string | null; name_jp?: string | null; name_kr?: string | null; name?: string | null; id?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(identity.name_en) ?? present(identity.name_jp) ?? present(identity.name_kr) ?? present(identity.name) ?? identity.id ?? ''
  if (locale === 'ja') return present(identity.name_jp) ?? present(identity.name_en) ?? present(identity.name_kr) ?? present(identity.name) ?? identity.id ?? ''
  return present(identity.name_kr) ?? present(identity.name) ?? present(identity.name_en) ?? present(identity.name_jp) ?? identity.id ?? ''
}

export function localizeSkillName(
  skill: { name: string; name_en?: string | null; name_jp?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(skill.name_en) ?? present(skill.name_jp) ?? skill.name
  if (locale === 'ja') return present(skill.name_jp) ?? present(skill.name_en) ?? skill.name
  return skill.name
}

export function localizeSkillDescription(
  skill: { description?: string | null; description_en?: string | null; description_jp?: string | null },
  locale: string,
): string | null {
  if (locale === 'en') return present(skill.description_en) ?? present(skill.description_jp) ?? present(skill.description)
  if (locale === 'ja') return present(skill.description_jp) ?? present(skill.description_en) ?? present(skill.description)
  return present(skill.description)
}

export function localizePassiveName(
  passive: { name: string; name_en?: string | null; name_jp?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(passive.name_en) ?? present(passive.name_jp) ?? passive.name
  if (locale === 'ja') return present(passive.name_jp) ?? present(passive.name_en) ?? passive.name
  return passive.name
}

export function localizePassiveDescription(
  passive: { description?: string | null; description_en?: string | null; description_jp?: string | null },
  locale: string,
): string | null {
  if (locale === 'en') return present(passive.description_en) ?? present(passive.description_jp) ?? present(passive.description)
  if (locale === 'ja') return present(passive.description_jp) ?? present(passive.description_en) ?? present(passive.description)
  return present(passive.description)
}

export function localizeEgoName(
  ego: { name_en?: string | null; name_jp?: string | null; name_kr?: string | null; name?: string | null; id?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(ego.name_en) ?? present(ego.name_jp) ?? present(ego.name_kr) ?? present(ego.name) ?? ego.id ?? ''
  if (locale === 'ja') return present(ego.name_jp) ?? present(ego.name_en) ?? present(ego.name_kr) ?? present(ego.name) ?? ego.id ?? ''
  return present(ego.name_kr) ?? present(ego.name) ?? present(ego.name_en) ?? present(ego.name_jp) ?? ego.id ?? ''
}

export function portraitUrl(
  sinner_id: string,
  folder_name: string | null,
  game_id: string | null,
  gacksung: boolean,
): string {
  if (!game_id || !folder_name) return ''
  return getIdentityPortraitUrl(sinner_id, folder_name, game_id, gacksung)
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
/** A passive's description, one block per line; a tag that spans lines (`<style="highlight">- a\n- b</style>`) keeps applying on each. */
export function PassiveDescriptionLines({ text, color, allowedKeywords }: { text: string; color: string; allowedKeywords?: ReadonlySet<string> }) {
  const formatSkillDesc = useFormatSkillDesc()
  return splitGameTextLines(text).map((line, li) => (
    <div key={li}>
      <span style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{formatSkillDesc(line, color, undefined, allowedKeywords, allowedKeywords ? { matchPlainKeywords: true } : undefined)}</span>
    </div>
  ))
}

export default function DeckIdentityCard({
  slot,
  egos,
  keywordMeta,
  onEgoClick,
}: {
  slot: IdentitySlot
  egos?: EgoEntry[]
  keywordMeta?: Record<string, { description: string }>
  onEgoClick?: (egoId: string) => void
}) {
  const lang = useLocale() as SupportedLang
  const detailT = useTranslations('decks.detail')
  const previewT = useTranslations('decks.identityPreview')
  const plainText = usePlainGameText(lang)
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const id_ = slot.identities!
  // The keywords of this identity (its keyword list and what its own skills and passives reference): plain words of older text are searched among these.
  const ownTexts = useMemo(() => descriptionTexts(id_.skills, id_.passives), [id_.skills, id_.passives])
  const allowedKeywords = useOwnKeywords(id_.keywords, ownTexts)
  const [activeTab, setActiveTab] = useState<'skills' | 'passives' | 'ego'>('skills')
  const identityName = localizeIdentityName(id_, lang)

  const rarityColor = RARITY_COLORS[id_.rarity] ?? '#667788'
  const imgUrl = portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, slot.gacksung)
  const normalUrl = portraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
  const themeKws = [...new Set((id_.keywords ?? []).map(normalizeThemeKeyword).filter(kw => THEME_KW_SET.has(kw)))]

  // 4동기화 우선: 같은 (skill_order, variant_order)에서 최고 uptie_level만 유지
  const rawSkills = id_.skills ?? []
  const skillBest = new Map<string, typeof rawSkills[0]>()
  for (const s of rawSkills) {
    const key = `${s.skill_order}:${(s as Record<string, unknown>).variant_order ?? 0}`
    const ex = skillBest.get(key)
    if (!ex || (s.uptie_level ?? 3) > (ex.uptie_level ?? 3)) skillBest.set(key, s)
  }
  const sortedSkills = [...skillBest.values()].sort((a, b) => a.skill_order - b.skill_order || ((a as Record<string, unknown>).variant_order as number ?? 0) - ((b as Record<string, unknown>).variant_order as number ?? 0))

  // 4동기화 우선: 같은 (passive_type, passive_order)에서 최고 uptie_level만 유지
  const rawPassives = id_.passives ?? []
  const passiveBest = new Map<string, typeof rawPassives[0]>()
  for (const p of rawPassives) {
    const key = `${p.passive_type}:${p.passive_order}`
    const ex = passiveBest.get(key)
    if (!ex || (p.uptie_level ?? 3) > (ex.uptie_level ?? 3)) passiveBest.set(key, p)
  }
  const sortedPassives = [...passiveBest.values()].sort((a, b) => a.passive_order - b.passive_order)

  const s1 = sortedSkills.find(s => s.skill_order === 1) ?? sortedSkills[0]
  const primaryColor = s1 ? sinColor(s1.sin_affinity) : rarityColor

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: '#0f0c09', border: '1px solid rgba(38,24,10,0.9)' }}
    >
      {/* 등급 컬러 바 */}
      <div style={{ height: '2px', background: rarityColor }} />

      {/* 상단: 포트레이트 + 기본 정보 */}
      <div className="flex">
        {/* 포트레이트 */}
        <div className="flex-shrink-0 flex flex-col" style={{ width: 88, borderRight: '1px solid rgba(32,20,8,0.7)' }}>
          <div className="relative overflow-hidden" style={{ width: 88, height: 116 }}>
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt={identityName}
                fill
                sizes="88px"
                className="object-cover"
                style={{ objectPosition: 'center top' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#0a0806' }} />
            )}
          </div>
          <div className="flex items-center justify-center flex-1" style={{ minHeight: 28 }}>
            <Image src={getSinnerLogoUrl(id_.sinner_id)} alt="" width={18} height={18} style={{ height: '1.125rem', width: 'auto', opacity: 0.3 }} />
          </div>
        </div>

        {/* 정보 영역 */}
        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <Link href={`/sinners/${id_.sinner_id}/identities/${id_.id}`} locale={lang} className="font-serif font-light text-base leading-tight hover:underline" style={{ color: '#e8e0d0' }}>{identityName}</Link>
            </div>
            {RARITY_ICON_MAP[id_.rarity] ? (
              <Image src={RARITY_ICON_MAP[id_.rarity]} alt={previewT('rarity', { rarity: id_.rarity })} width={id_.rarity === 1 ? 16 : id_.rarity === 2 ? 30 : 36} height={14} style={{ flexShrink: 0, opacity: 0.9, height: '0.875rem', width: 'auto' }} />
            ) : (
              <span className="flex-shrink-0 px-1.5 py-px rounded" style={{ background: `${rarityColor}18`, color: rarityColor, border: `1px solid ${rarityColor}38`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                {previewT('rarity', { rarity: id_.rarity })}
              </span>
            )}
          </div>

          {/* 테마 키워드 */}
          {themeKws.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {themeKws.map(kw => {
                const iconUrl = getIconUrl(kw)
                const rawDesc = keywordMeta?.[kw]?.description
                const desc = rawDesc ? plainText(rawDesc, { keepPlaceholders: false }) : rawDesc
                return (
                  <span key={kw} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" title={desc} style={{ background: 'rgba(120,76,28,0.12)', color: 'var(--gold-dim)', border: '1px solid rgba(120,76,28,0.22)', fontFamily: 'var(--font-heading)', fontSize: '0.75rem', cursor: desc ? 'help' : 'default' }}>
                    {iconUrl && <Image src={iconUrl} alt="" width={14} height={14} />}
                    {localizeDeckKeyword(kw, keywords[kw], lang)}
                  </span>
                )
              })}
            </div>
          )}

          {/* 스탯 */}
          <div className="flex items-center gap-3 mb-2.5">
            {id_.hp != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                <Image src={STAT_ICON_URL.hp} alt="HP" width={16} height={16} style={{ opacity: 0.9 }} />
                <strong style={{ color: 'var(--error-text)' }}>{id_.hp}</strong>
              </span>
            )}
            {id_.speed_min != null && id_.speed_max != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                <Image src={STAT_ICON_URL.spd} alt="SPD" width={16} height={16} style={{ opacity: 0.9 }} />
                <strong style={{ color: '#88a830' }}>{id_.speed_min}-{id_.speed_max}</strong>
              </span>
            )}
            {id_.def_level != null && (
              <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                <Image src={STAT_ICON_URL.def} alt="DEF" width={16} height={16} style={{ opacity: 0.9 }} />
                <strong style={{ color: '#4898b0' }}>{id_.def_level}</strong>
              </span>
            )}
          </div>

          {/* 저항 */}
          <div className="flex flex-wrap gap-1">
            {([
              { label: 'slash', iconKey: '참', val: id_.slash_res },
              { label: 'pierce', iconKey: '관', val: id_.pierce_res },
              { label: 'blunt', iconKey: '타', val: id_.blunt_res },
            ] as { label: string; iconKey: string; val: string | null }[]).map(({ label, iconKey, val }) => {
              if (!val) return null
              const st = RES_STYLE[val] ?? { color: 'var(--text-muted)', bg: 'rgba(48,48,64,0.15)', border: 'rgba(80,80,100,0.2)' }
              return (
                <span key={label} className="inline-flex items-center gap-0.5 px-1.5 py-px rounded" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  <Image src={RES_ATK_ICON[iconKey]} alt={localizeDeckKeyword(label, keywords[label], lang)} width={12} height={12} style={{ opacity: 0.75 }} />
                  {previewT(`resistance.${resistanceMessageKey(val)}`)}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* 스킬 / 패시브 / E.G.O 탭 바 */}
      <div className="flex" style={{ borderTop: '1px solid rgba(28,16,6,0.9)', background: 'rgba(0,0,0,0.18)' }}>
        {([
          { key: 'skills' as const, label: previewT('skills'), count: sortedSkills.length },
          { key: 'passives' as const, label: previewT('passives'), count: sortedPassives.length },
          ...(egos && egos.length > 0 ? [{ key: 'ego' as const, label: previewT('ego'), count: egos.length }] : []),
        ]).map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-2 text-xs transition"
              style={{
                background: isActive ? `${primaryColor}12` : 'transparent',
                color: isActive ? '#d0c8b8' : '#5a5070',
                borderBottom: `2px solid ${isActive ? primaryColor + '55' : 'transparent'}`,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.05em',
              }}
            >
              {tab.label}
              <span className="ml-2" style={{ color: isActive ? primaryColor : '#5a5065', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', opacity: 0.8 }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 스킬 탭 */}
      {activeTab === 'skills' && (
        <div className="flex flex-col gap-2 p-3">
          {sortedSkills.length === 0 ? (
            <p style={{ color: '#8a8095', fontSize: '0.875rem', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>{previewT('noSkills')}</p>
          ) : sortedSkills.map(skill => (
            <IdentitySkillFrameCard
              key={skill.id}
              skill={skill}
              skills={sortedSkills}
              identity={id_}
              lang={lang}
              allowedKeywords={allowedKeywords}
            />
          ))}
        </div>
      )}

      {/* 패시브 탭 */}
      {activeTab === 'passives' && (
        <div className="flex flex-col gap-2 p-3">
          {sortedPassives.length === 0 ? (
            <p style={{ color: '#8a8095', fontSize: '0.6875rem', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>{previewT('noPassives')}</p>
          ) : sortedPassives.map((passive, idx) => {
            const isBattle = passive.passive_type === 'battle'
            const requirements = passiveRequirements(passive)
            const pc = requirements[0] ? (SIN_COLORS[requirements[0].sin] ?? '#cccccc') : '#cccccc'
            const passiveName = localizePassiveName(passive, lang)
            const passiveDescription = localizePassiveDescription(passive, lang)
            return (
              <div key={idx} className="p-3 rounded" style={{ background: `${pc}08`, border: `1px solid ${pc}25` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                    style={{
                      background: isBattle ? 'rgba(200,64,80,0.15)' : 'rgba(72,120,160,0.15)',
                      color: isBattle ? '#c84050' : '#4898b0',
                      border: `1px solid ${isBattle ? 'rgba(200,64,80,0.3)' : 'rgba(72,120,160,0.3)'}`,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {isBattle ? detailT('battlePassive') : detailT('supportPassive')}
                  </span>
                  <span className="font-semibold" style={{ color: pc, fontSize: '0.8125rem' }}>{passiveName}</span>
                </div>

                {(requirements.length > 0 || passive.active_cond) && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {requirements.map(req => (
                      <span key={req.sin} className="inline-flex items-center gap-0.5" style={{ color: pc }}>
                        <Image src={sinIconUrl(req.sin)} alt="" width={20} height={20} style={{ filter: `drop-shadow(0 0 2px ${SIN_COLORS[req.sin] ?? pc}60)` }} />
                        <MultipliedCount value={req.count} style={{ fontSize: '0.8125rem', fontWeight: 700, color: pc }} />
                      </span>
                    ))}
                    {passive.active_cond && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${pc}18`, color: pc, border: `1px solid ${pc}35` }}>
                        {passive.active_cond === 'resonance' ? detailT('passiveResonance') : passive.active_cond === 'stock' ? detailT('passiveStock') : passive.active_cond}
                      </span>
                    )}
                  </div>
                )}

                {passiveDescription && (
                  <div style={{ fontSize: '0.6875rem', lineHeight: 1.8 }}>
                    <PassiveDescriptionLines text={passiveDescription} color={pc} allowedKeywords={allowedKeywords} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* E.G.O 탭 */}
      {activeTab === 'ego' && egos && (
        <div className="flex flex-col gap-2 p-3">
          {egos.map(({ grade, ego }) => {
            const gc = GRADE_COLORS[grade] ?? '#667788'
            const sinEn = ego.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
            const sc = sinEn ? (SIN_COLORS[sinEn as SinType] ?? gc) : gc
            const egoName = localizeEgoName(ego, lang)
            return (
              <div key={ego.id} className="p-3 rounded flex items-center gap-3"
                onClick={e => { e.stopPropagation(); onEgoClick?.(ego.id) }}
                style={{ background: `${sc}08`, border: `1px solid ${sc}28`, cursor: onEgoClick ? 'pointer' : 'default' }}>
                <div style={{ width: 2, alignSelf: 'stretch', background: sc, borderRadius: 1, flexShrink: 0 }} />
                {ego.image_url ? (
                  <Image src={ego.image_url} alt={egoName} width={52} height={52}
                    style={{ borderRadius: 4, objectFit: 'cover', border: `1px solid ${sc}30`, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 4, background: '#0a0806', border: `1px solid ${gc}20`, flexShrink: 0 }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-px rounded" style={{ background: `${gc}18`, color: gc, border: `1px solid ${gc}38`, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                      E.G.O
                    </span>
                    {GRADE_ICON_URL[grade] ? (
                      <Image src={GRADE_ICON_URL[grade]} alt={grade} width={32} height={12} style={{ opacity: 0.9 }} />
                    ) : (
                      <span style={{ color: gc, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{grade}</span>
                    )}
                    {sinEn && (
                      <Image src={sinIconUrl(sinEn)} alt="" width={12} height={12} style={{ opacity: 0.8 }} />
                    )}
                  </div>
                  <span className="font-serif font-light" style={{ color: sc, fontSize: '0.8125rem' }}>{egoName}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
