'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { type NoteSkillEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry, type NotePassiveEntry } from '@/components/decks/NoteChips'
import { buildKeywordPool, buildEgoGiftPool, type AutocompleteSuggestion } from '@/components/notes/NoteAutocomplete'
import { type Sinner, type Identity, type Skill, type Passive, type EGO, SIN_COLORS, SIN_KR_TO_EN, SKILL_TYPE_LABELS, getIdentityProfileUrl, getIdentityInfoUrl, getSkillIconUrl, getSinIconUrl } from '@/lib/data/sinners'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

type GuideDataInput = {
  sinner: Sinner
  identity: Identity
  filteredSkills: Skill[]
  filteredPassives: Passive[]
  allSinners: Sinner[]
  allIdentities: Identity[]
  allEgos: EGO[]
  egoGifts: { name: string; keyword: string; grade: string; image_url: string | null; effect_base: string | null }[]
  variantMap: Record<string, { baseOrder: number; idx: number; total: number }>
  skillImgIdxMap: Record<string, number>
}

export function useIdentityGuideData({ sinner, identity, filteredSkills, filteredPassives, allSinners, allIdentities, allEgos, egoGifts, variantMap, skillImgIdxMap }: GuideDataInput) {
  const t = useTranslations()
  const lang = useLocale() as SupportedLang
  const { sinMap: kwSinMap, keywords: kwContext } = useKeywordData()
  const localSkillName = (s: Skill) =>
    lang === 'en' && s.name_en ? s.name_en : lang === 'ja' && s.name_jp ? s.name_jp : s.name
  const localPassiveName = (p: Passive) =>
    lang === 'en' && p.name_en ? p.name_en : lang === 'ja' && p.name_jp ? p.name_jp : p.name
  const localSkillDesc = (s: Skill) =>
    lang === 'en' && s.description_en ? s.description_en : lang === 'ja' && s.description_jp ? s.description_jp : s.description
  const localPassiveDesc = (p: Passive) =>
    lang === 'en' && p.description_en ? p.description_en : lang === 'ja' && p.description_jp ? p.description_jp : p.description
  // sinner_id → name_kr 매핑
  const sinnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allSinners) map[s.id] = s.name_kr
    return map
  }, [allSinners])

  // sinner_id → name_en / name_jp 매핑 (chip token EN/JP 룩업용)
  const sinnerNameMapEn = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allSinners) {
      if (s.name_en) map[s.id] = s.name_en
    }
    return map
  }, [allSinners])

  const sinnerNameMapJp = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of allSinners) {
      if (s.name_jp) map[s.id] = s.name_jp
    }
    return map
  }, [allSinners])

  // 토큰 룩업 맵들 (NoteRenderer / 자동완성용)
  const skillTokenLookup = useMemo(() => {
    const map: Record<string, NoteSkillEntry> = {}
    for (const sk of filteredSkills) {
      const v = variantMap[sk.id]
      const base = v?.baseOrder ?? (sk.skill_order >= 5 ? 3 : sk.skill_order)
      const key = v && v.total > 1
        ? `${sinner.name_kr}:${base}:${v.idx}`
        : `${sinner.name_kr}:${base}`
      map[key] = {
        name: localSkillName(sk), skill_type: sk.skill_type, sin_affinity: sk.sin_affinity as string,
        skill_order: sk.skill_order, description: localSkillDesc(sk),
        iconUrl: getSkillIconUrl(identity, skillImgIdxMap[sk.id] ?? sk.skill_order, sk),
        identityName: getLocalizedName(identity, lang), sinnerName: getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang),
      }
      // EN key alias
      if (sinner.name_en) {
        const enKey = v && v.total > 1
          ? `${sinner.name_en}:${base}:${v.idx}`
          : `${sinner.name_en}:${base}`
        map[enKey] = map[key]
      }
      // JP key alias
      if (sinner.name_jp) {
        const jpKey = v && v.total > 1
          ? `${sinner.name_jp}:${base}:${v.idx}`
          : `${sinner.name_jp}:${base}`
        map[jpKey] = map[key]
      }
    }
    return map
  }, [filteredSkills, sinner.name_kr, sinner.name, sinner.name_en, sinner.name_jp, identity, skillImgIdxMap, variantMap, lang])

  const egoTokenLookup = useMemo(() => {
    const map: Record<string, NoteEgoEntry> = {}
    for (const ego of allEgos) {
      const nameKr = ego.name_kr || ego.name
      const localizedName = lang === 'en' ? (ego.name_en || nameKr) : lang === 'ja' ? (ego.name_jp || nameKr) : nameKr
      const sinnerKr = sinnerNameMap[ego.sinner_id] ?? sinner.name_kr
      const sinnerEn = sinnerNameMapEn[ego.sinner_id]
      const sinnerJp = sinnerNameMapJp[ego.sinner_id]
      const sinnerName = lang === 'en' ? (sinnerEn || sinnerKr) : lang === 'ja' ? (sinnerJp || sinnerKr) : sinnerKr
      const entry: NoteEgoEntry = {
        name: localizedName, grade: ego.grade, sin_affinity: ego.sin_affinity,
        image_url: ego.image_url, sinnerName,
      }
      // Saved note tokens keep their Korean aliases.
      map[`${sinnerKr}:${nameKr}`] = entry
      // EN key alias
      if (sinnerEn) map[`${sinnerEn}:${nameKr}`] = entry
      if (sinnerEn && ego.name_en) map[`${sinnerEn}:${ego.name_en}`] = entry
      // JP key alias
      if (sinnerJp) map[`${sinnerJp}:${nameKr}`] = entry
      if (sinnerJp && ego.name_jp) map[`${sinnerJp}:${ego.name_jp}`] = entry
    }
    return map
  }, [allEgos, sinnerNameMap, sinnerNameMapEn, sinnerNameMapJp, sinner.name_kr, sinner.name, sinner.name_jp, lang])

  const identityTokenLookup = useMemo(() => {
    const map: Record<string, NoteIdentityEntry> = {}
    for (const ident of allIdentities) {
      const sinnerKr = sinnerNameMap[ident.sinner_id] ?? ''
      const sinnerEn = sinnerNameMapEn[ident.sinner_id]
      const sinnerJp = sinnerNameMapJp[ident.sinner_id]
      const entry: NoteIdentityEntry = {
        name: getLocalizedName(ident, lang), rarity: ident.rarity,
        imageUrl: getIdentityProfileUrl(ident, false),
        sinnerName: lang === 'en' ? (sinnerEn || sinnerKr) : lang === 'ja' ? (sinnerJp || sinnerKr) : sinnerKr, keywords: ident.keywords,
      }
      // KR key
      map[`${sinnerKr}:${ident.name_kr}`] = entry
      if (sinnerKr === sinner.name_kr || !map[ident.name_kr]) {
        map[ident.name_kr] = entry
      }
      // EN key aliases
      if (sinnerEn && ident.name_en) {
        map[`${sinnerEn}:${ident.name_en}`] = entry
      }
      // Saved notes can combine a localized sinner and Korean identity name.
      if (sinnerEn) map[`${sinnerEn}:${ident.name_kr}`] = entry
      // EN identity name only
      if (ident.name_en && (sinnerKr === sinner.name_kr || !map[ident.name_en])) {
        map[ident.name_en] = entry
      }
      // JP key aliases
      if (sinnerJp && ident.name_jp) {
        map[`${sinnerJp}:${ident.name_jp}`] = entry
      }
      // Preserve mixed-language tokens in existing notes.
      if (sinnerJp) map[`${sinnerJp}:${ident.name_kr}`] = entry
      // JP identity name only
      if (ident.name_jp && (sinnerKr === sinner.name_kr || !map[ident.name_jp])) {
        map[ident.name_jp] = entry
      }
    }
    return map
  }, [allIdentities, sinnerNameMap, sinnerNameMapEn, sinnerNameMapJp, sinner.name_kr, lang])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of egoGifts) {
      map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade, image_url: g.image_url, effect_base: g.effect_base }
    }
    return map
  }, [egoGifts])

  const passiveLookup = useMemo(() => {
    const map: Record<string, NotePassiveEntry> = {}
    for (const ps of filteredPassives) {
      const sinEn = ps.sin_affinity ? (SIN_KR_TO_EN[ps.sin_affinity] ?? ps.sin_affinity) : null
      const entry: NotePassiveEntry = {
        name: localPassiveName(ps),
        sin_affinity: sinEn,
        sin_count: ps.sin_count ?? null,
        active_cond: ps.active_cond ?? null,
        description: localPassiveDesc(ps) ?? null,
        sinnerName: getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang),
        imageUrl: getIdentityInfoUrl(identity) || undefined,
      }
      map[ps.name] = entry
      // EN key
      const nameEn = (ps as Record<string, unknown>).name_en as string | undefined
      if (nameEn) map[nameEn] = entry
      // JP key
      const nameJp = (ps as Record<string, unknown>).name_jp as string | undefined
      if (nameJp) map[nameJp] = entry
    }
    return map
  }, [filteredPassives, identity, sinner.name_kr, sinner.name, sinner.name_jp, lang])

  // 자동완성 풀
  const acPool = useMemo((): AutocompleteSuggestion[] => {
    const pool: AutocompleteSuggestion[] = []
    for (const sk of filteredSkills) {
      const sc = SIN_COLORS[sk.sin_affinity] || '#cccccc'
      const v = variantMap[sk.id]
      const base = v?.baseOrder ?? (sk.skill_order >= 5 ? 3 : sk.skill_order)
      const isDefense = base === 4
      const orderLabel = isDefense
        ? (v && v.total > 1
          ? `${SKILL_TYPE_LABELS[sk.skill_type] || sk.skill_type}-${v.idx}`
          : SKILL_TYPE_LABELS[sk.skill_type] || sk.skill_type)
        : (v && v.total > 1 ? `S${base}-${v.idx}` : `S${base}`)
      const token = v && v.total > 1
        ? `[s:${sinner.name_kr}:${base}:${v.idx}]`
        : `[s:${sinner.name_kr}:${base}]`
      pool.push({
        label: `${orderLabel} ${localSkillName(sk)}`, type: 'skill', typeLabel: t('identity.tab.skills'), color: sc,
        iconUrl: getSkillIconUrl(identity, skillImgIdxMap[sk.id] ?? sk.skill_order, sk),
        token,
      })
    }
    for (const ps of filteredPassives) {
      const sinEn = ps.sin_affinity ? (SIN_KR_TO_EN[ps.sin_affinity] ?? ps.sin_affinity) : null
      const sc = sinEn ? (SIN_COLORS[sinEn] ?? '#88a830') : '#88a830'
      pool.push({
        label: localPassiveName(ps),
        type: 'passive' as const,
        typeLabel: ps.passive_type === 'battle' ? t('identity.passiveType.battle') : t('identity.passiveType.support'),
        color: sc,
        iconUrl: sinEn ? getSinIconUrl(sinEn) : undefined,
        token: `[p:${ps.name}]`,
      })
    }
    for (const ident of allIdentities) {
      const mainKw = ident.keywords?.find(kw => kwSinMap[kw])
      const sinType = mainKw ? kwSinMap[mainKw] : undefined
      const sc = sinType ? (SIN_COLORS[sinType] ?? '#c8900a') : '#c8900a'
      const sinnerName = sinnerNameMap[ident.sinner_id] ?? ''
      pool.push({
        label: getLocalizedName(ident, lang), type: 'identity', typeLabel: sinnerName || t('sinners.identities'), color: sc,
        imageUrl: getIdentityProfileUrl(ident, false),
        token: `[i:${sinnerName}:${ident.name_kr}]`,
      })
    }
    for (const ego of allEgos) {
      const nameKr = ego.name_kr || ego.name
      const localEgoName = getLocalizedName({ name_kr: ego.name_kr || ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)
      const sc = ego.sin_affinity ? (SIN_COLORS[ego.sin_affinity] ?? '#c8900a') : '#c8900a'
      const sinnerName = sinnerNameMap[ego.sinner_id] ?? getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)
      pool.push({
        label: localEgoName, type: 'ego', typeLabel: sinnerName || 'E.G.O', color: sc,
        imageUrl: ego.image_url ?? undefined,
        token: `[e:${sinnerName}:${nameKr}]`,
      })
    }
    pool.push(...buildKeywordPool(kwContext))
    pool.push(...buildEgoGiftPool(egoGifts))
    return pool
  }, [filteredSkills, filteredPassives, allIdentities, allEgos, sinnerNameMap, sinner.name_kr, sinner.name, sinner.name_jp, identity, skillImgIdxMap, variantMap, egoGifts, kwSinMap, kwContext, lang, t])

  return { skillTokenLookup, egoTokenLookup, identityTokenLookup, egoGiftLookup, passiveLookup, acPool }
}
