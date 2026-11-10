import { SINNER_SLUGS, STORAGE_BASE } from '@/lib/constants/game'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { normalizeSin } from '@/lib/constants/sin'
import { computeSkillImageIndices, getIdentityPortraitUrl } from '@/lib/utils/images'
import { skillSlot } from '@/lib/identity/skill-model'
import type { Identity, Skill } from '@/lib/types'
import type { IdentityDetail, IdentitySlot } from '@/features/decks/components/DeckIdentityCard'
import type { NoteEgoEntry, NoteIdentityEntry, NotePassiveEntry, NoteSkillEntry } from '@/features/decks/components/NoteChips'
import { localizeEgoName, localizeIdentityName, localizePassiveDescription, localizePassiveName, localizeSkillDescription, localizeSkillName } from './localize'
import { topUptiePassives, topUptieSkills } from './deck-identity-uptie'

export type SinnerEgo = {
  sinner_id: string
  id?: string | null
  name?: string | null
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
}

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

export const BOARD_SLOT_COUNT = 12

export function buildBoardSlots(slots: IdentitySlot[]): (IdentitySlot | null)[] {
  const board: (IdentitySlot | null)[] = Array.from({ length: BOARD_SLOT_COUNT }, () => null)
  const bySinner = new Map<string, IdentitySlot>()

  for (const slot of slots.filter(slot => slot.identities)) {
    const sinnerId = slot.identities!.sinner_id
    const existing = bySinner.get(sinnerId)
    const shouldReplace =
      !existing ||
      (slot.slot_order < 99 && existing.slot_order === 99) ||
      (slot.slot_order < 99 && existing.slot_order < 99 && slot.slot_order < existing.slot_order) ||
      (slot.slot_order === 99 && existing.slot_order === 99 && slot.slot_order < existing.slot_order)

    if (shouldReplace) bySinner.set(sinnerId, slot)
  }

  SINNER_SLUGS.forEach((sinnerId, index) => {
    board[index] = bySinner.get(sinnerId) ?? null
  })

  return board
}

export function topKeywords(slots: IdentitySlot[]): string[] {
  const formed = slots.filter(s => s.slot_order < 99 && s.identities)
  const total = formed.length
  if (total === 0) return []

  const freq: Record<string, number> = {}
  for (const slot of formed) {
    for (const kw of slot.identities?.keywords ?? []) {
      const nkw = normalizeThemeKeyword(kw)
      if (THEME_KW_SET.has(nkw)) freq[nkw] = (freq[nkw] ?? 0) + 1
    }
  }

  const minCount = total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.4))
  return Object.entries(freq)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw)
}

export function adaptBoardIdentity(identity: IdentityDetail, locale: string): Identity {
  const name = localizeIdentityName(identity, locale)
  return {
    id: identity.id,
    sinner_id: identity.sinner_id,
    name,
    name_kr: identity.name_kr,
    name_en: identity.name_en,
    name_jp: identity.name_jp,
    tier: identity.tier,
    hp: identity.hp ?? 0,
    speed_min: identity.speed_min ?? 0,
    speed_max: identity.speed_max ?? 0,
    def_level: identity.def_level ?? 0,
    keywords: identity.keywords ?? [],
    rarity: identity.rarity,
    slash_res: identity.slash_res ?? undefined,
    pierce_res: identity.pierce_res ?? undefined,
    blunt_res: identity.blunt_res ?? undefined,
    game_id: identity.game_id,
    folder_name: identity.folder_name,
  }
}

const SINNER_NAMES: Record<string, string> = {
  'yi-sang': '이상', 'faust': '파우스트', 'don-quixote': '돈키호테',
  'ryoshu': '료슈', 'meursault': '뫼르소', 'hong-lu': '홍루',
  'heathcliff': '히스클리프', 'ishmael': '이스마엘', 'rodion': '로쟈',
  'sinclair': '싱클레어', 'outis': '오티스', 'gregor': '그레고르',
}

function uniqueNames(...names: Array<string | null | undefined>): string[] {
  return [...new Set(names.map(name => name?.trim()).filter((name): name is string => Boolean(name)))]
}

function getNoteSkillBaseOrder(skill: Pick<IdentityDetail['skills'][number], 'skill_order' | 'skill_type'>): number {
  return skillSlot(skill)
}

export function buildNoteLookups(
  slots: IdentitySlot[],
  allEgos: SinnerEgo[],
  locale: string,
  localizeSinnerName: (sinnerId: string) => string,
) {
  const skillLookup: Record<string, NoteSkillEntry> = {}
  const passiveLookup: Record<string, NotePassiveEntry> = {}
  const egoLookup: Record<string, NoteEgoEntry> = {}
  const identityLookup: Record<string, NoteIdentityEntry> = {}

  for (const slot of slots) {
    const id_ = slot.identities
    if (!id_) continue
    const koreanSinnerName = SINNER_NAMES[id_.sinner_id] ?? id_.sinner_id
    const localizedSinnerName = localizeSinnerName(id_.sinner_id)
    const sinnerTokenNames = uniqueNames(koreanSinnerName, localizedSinnerName)
    const identityName = localizeIdentityName(id_, locale)
    const identityImageUrl = id_.game_id && id_.folder_name
      ? getIdentityPortraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
      : undefined

    const identityEntry: NoteIdentityEntry = {
      name: identityName,
      rarity: id_.rarity,
      imageUrl: identityImageUrl,
      sinnerName: localizedSinnerName,
      keywords: id_.keywords ?? undefined,
    }
    for (const sinnerName of sinnerTokenNames) {
      for (const name of uniqueNames(id_.name_kr, id_.name, id_.name_en, id_.name_jp, identityName)) {
        identityLookup[`${sinnerName}:${name}`] = identityEntry
      }
    }

    const sortedSkills = topUptieSkills(id_.skills ?? []).sort((a, b) => a.skill_order - b.skill_order || ((a as Record<string, unknown>).variant_order as number ?? 0) - ((b as Record<string, unknown>).variant_order as number ?? 0))
    const frameSkills: Skill[] = sortedSkills.map(skill => ({
      ...skill,
      identity_id: id_.id,
      sin_affinity: (normalizeSin(skill.sin_affinity) ?? 'wrath') as Skill['sin_affinity'],
      description: localizeSkillDescription(skill, locale) ?? skill.description ?? '',
      atk_weight: skill.atk_weight ?? undefined,
      offense_level: skill.offense_level ?? undefined,
      uptie_level: skill.uptie_level ?? undefined,
      variant_order: skill.variant_order ?? undefined,
    }))
    const frameSkillById = new Map(frameSkills.map(skill => [skill.id, skill]))
    const imgIdx = computeSkillImageIndices(sortedSkills)
    const orderCount: Record<number, number> = {}
    for (const sk of sortedSkills) {
      const baseOrder = getNoteSkillBaseOrder(sk)
      const subIdx = orderCount[baseOrder] || 0
      orderCount[baseOrder] = subIdx + 1
      const iconUrl = id_.game_id
        ? `${STORAGE_BASE}/icons/skills/${id_.sinner_id}/${id_.game_id}${String(imgIdx[sk.id] ?? sk.skill_order).padStart(2, '0')}.webp`
        : undefined
      const entry = {
        name: localizeSkillName(sk, locale), skill_type: sk.atk_type ?? sk.skill_type, sin_affinity: sk.sin_affinity,
        skill_order: sk.skill_order, description: localizeSkillDescription(sk, locale),
        iconUrl, identityName, sinnerName: localizedSinnerName,
        skill: frameSkillById.get(sk.id),
        skills: frameSkills,
        identity: { sinner_id: id_.sinner_id, game_id: id_.game_id, keywords: id_.keywords },
      }
      for (const sinnerName of sinnerTokenNames) {
        const key = subIdx === 0
          ? `${sinnerName}:${baseOrder}`
          : `${sinnerName}:${baseOrder}:${subIdx + 1}`
        skillLookup[key] = entry
        if (subIdx === 1) {
          skillLookup[`${sinnerName}:${baseOrder}:1`] = entry
        }
        // 이전 형식 호환: S3 변형처럼 원래 skill_order로 저장된 토큰도 인식
        if (sk.skill_order !== baseOrder) {
          skillLookup[`${sinnerName}:${sk.skill_order}`] = entry
        }
      }
    }
    for (const pa of topUptiePassives(id_.passives ?? [])) {
      const entry = {
        name: localizePassiveName(pa, locale), sin_affinity: pa.sin_affinity,
        sin_count: pa.sin_count, sin_requirements: pa.sin_requirements, active_cond: pa.active_cond,
        description: localizePassiveDescription(pa, locale), sinnerName: localizedSinnerName,
        imageUrl: identityImageUrl,
      }
      for (const passiveName of uniqueNames(pa.name, localizePassiveName(pa, locale))) {
        passiveLookup[passiveName] = entry
      }
    }
  }
  for (const ego of allEgos) {
    const koreanSinnerName = SINNER_NAMES[ego.sinner_id] ?? ego.sinner_id
    const localizedSinnerName = localizeSinnerName(ego.sinner_id)
    const name = localizeEgoName(ego, locale)
    const entry = {
      name, grade: ego.grade, sin_affinity: ego.sin_affinity,
      image_url: ego.image_url, sinnerName: localizedSinnerName,
    }
    for (const sinnerName of uniqueNames(koreanSinnerName, localizedSinnerName)) {
      for (const egoName of uniqueNames(ego.name_kr, ego.name, ego.name_en, ego.name_jp, name)) {
        egoLookup[`${sinnerName}:${egoName}`] = entry
      }
    }
  }
  return { skillLookup, passiveLookup, egoLookup, identityLookup }
}
