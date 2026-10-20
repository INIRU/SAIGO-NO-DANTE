'use client'
import { useMemo } from 'react'
import { Sinner, Identity, EGO, Skill, Passive, getIdentityInfoUrl, computeSkillImageIndices, getSkillIconUrl, type ActivationCondition } from '@/lib/data/sinners'
import { NoteRenderer, type NoteSkillEntry, type NotePassiveEntry, type NoteEgoEntry, type NoteIdentityEntry, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import NoteDocumentEditor from '@/components/notes/NoteDocumentEditor'
import { localizeIdentityName } from '@/components/deck-detail/DeckIdentityCard'
import { getGiftActivationConditionStatus } from '@/lib/planner/gift-condition-status'
import { getDeckIdentityAffiliations } from '@/lib/decks/keyword-rules'
import type { SupportedLang } from '@/lib/i18n/types'
import { DEPLOYED_SLOT_COUNT } from '@/lib/constants/game'
function getNoteSkillBaseOrder(skill: Skill): number {
  if (['evade', 'defense', 'counter'].includes(skill.skill_type)) return 4
  if (skill.skill_order >= 5) return 3
  return skill.skill_order
}
interface Props {
  sinners: Sinner[]
  identities: Identity[]
  deckSlots: Record<string, Identity | undefined>
  egoSlots: Record<string, Record<string, EGO>>
  skillsByIdentityId: Record<string, Skill[]>
  passivesByIdentityId: Record<string, Passive[]>
  egoGifts: {
    name: string
    keyword: string
    grade: string
    image_url: string | null
    effect_base: string | null
    activation_condition: ActivationCondition | null
  }[]
  formationOrder: string[]
  formationGiftKeywordCounts: Record<string, number>
  allGiftKeywordCounts: Record<string, number>
  locale: SupportedLang
  description: string
  setDescription: (v: string) => void
  descPreview: boolean
  setDescPreview: (v: boolean | ((prev: boolean) => boolean)) => void
}

export default function DeckNoteEditor({
  sinners, identities, deckSlots, egoSlots, skillsByIdentityId, passivesByIdentityId,
  egoGifts, formationOrder, formationGiftKeywordCounts, allGiftKeywordCounts, locale,
  description, setDescription, descPreview, setDescPreview,
}: Props) {
  const skillTokenLookup = useMemo(() => {
    const map: Record<string, NoteSkillEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      const idSkills = skillsByIdentityId[identity.id] ?? []
      const imgIdx = computeSkillImageIndices(idSkills)
      const orderCount: Record<number, number> = {}
      for (const sk of idSkills) {
        const baseOrder = getNoteSkillBaseOrder(sk)
        const subIdx = orderCount[baseOrder] || 0
        orderCount[baseOrder] = subIdx + 1
        const key = subIdx === 0
          ? `${sinnerName}:${baseOrder}`
          : `${sinnerName}:${baseOrder}:${subIdx + 1}`
        const entry = {
          name: sk.name,
          skill_type: sk.skill_type,
          sin_affinity: sk.sin_affinity as string,
          skill_order: sk.skill_order,
          description: sk.description,
          iconUrl: getSkillIconUrl(identity, imgIdx[sk.id] ?? sk.skill_order, sk),
          identityName: identity.name_kr,
          sinnerName,
          skill: sk,
          skills: idSkills,
          identity: { sinner_id: identity.sinner_id, game_id: identity.game_id },
        }
        map[key] = entry
        if (subIdx === 1) map[`${sinnerName}:${baseOrder}:1`] = entry
        if (sk.skill_order !== baseOrder) map[`${sinnerName}:${sk.skill_order}`] = entry
      }
    }
    return map
  }, [deckSlots, skillsByIdentityId, sinners])

  const passiveTokenLookup = useMemo(() => {
    const map: Record<string, NotePassiveEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const p of passivesByIdentityId[identity.id] ?? []) {
        map[p.name] = {
          name: p.name,
          sin_affinity: p.sin_affinity,
          sin_count: p.sin_count,
          sin_requirements: p.sin_requirements,
          active_cond: p.active_cond,
          description: p.description,
          sinnerName,
          imageUrl: getIdentityInfoUrl(identity) || undefined,
        }
      }
    }
    return map
  }, [deckSlots, passivesByIdentityId, sinners])

  const egoTokenLookup = useMemo(() => {
    const map: Record<string, NoteEgoEntry> = {}
    for (const identity of Object.values(deckSlots)) {
      if (!identity) continue
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      for (const ego of Object.values(egoSlots[identity.sinner_id] ?? {})) {
        const name = ego.name_kr || ego.name
        map[`${sinnerName}:${name}`] = {
          name,
          grade: ego.grade,
          sin_affinity: ego.sin_affinity,
          image_url: ego.image_url,
          sinnerName,
        }
      }
    }
    return map
  }, [deckSlots, egoSlots, sinners])

  const identityLookup = useMemo(() => {
    const map: Record<string, NoteIdentityEntry> = {}
    for (const identity of identities) {
      const sinnerName = sinners.find(s => s.id === identity.sinner_id)?.name_kr ?? identity.name_kr
      map[`${sinnerName}:${identity.name_kr}`] = {
        name: localizeIdentityName(identity, locale),
        rarity: identity.rarity,
        imageUrl: getIdentityInfoUrl(identity) || undefined,
        sinnerName,
        keywords: identity.keywords,
      }
    }
    return map
  }, [identities, locale, sinners])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of egoGifts) {
      map[g.name] = {
        name: g.name,
        keyword: g.keyword,
        grade: g.grade,
        image_url: g.image_url,
        effect_base: g.effect_base,
        activation_condition: g.activation_condition,
      }
    }
    return map
  }, [egoGifts])

  const egoGiftConditionLookup = useMemo(() => {
    const formationAffiliationCounts: Record<string, number> = {}
    const allAffiliationCounts: Record<string, number> = {}
    const activeFormationIds = new Set(formationOrder.slice(0, DEPLOYED_SLOT_COUNT))
    const assignedIds = new Set(formationOrder)

    for (const [sinnerId, identity] of Object.entries(deckSlots)) {
      if (!identity) continue
      const affiliations = getDeckIdentityAffiliations(identity)
      if (activeFormationIds.has(sinnerId)) {
        for (const affiliation of affiliations) {
          formationAffiliationCounts[affiliation] = (formationAffiliationCounts[affiliation] ?? 0) + 1
        }
      }
      if (assignedIds.has(sinnerId)) {
        for (const affiliation of affiliations) {
          allAffiliationCounts[affiliation] = (allAffiliationCounts[affiliation] ?? 0) + 1
        }
      }
    }

    const map: Record<string, ReturnType<typeof getGiftActivationConditionStatus>> = {}
    for (const gift of egoGifts) {
      map[gift.name] = getGiftActivationConditionStatus({
        gift,
        formationKeywordCounts: formationGiftKeywordCounts,
        allKeywordCounts: allGiftKeywordCounts,
        formationAffiliationCounts,
        allAffiliationCounts,
      })
    }
    return map
  }, [allGiftKeywordCounts, deckSlots, egoGifts, formationGiftKeywordCounts, formationOrder])

  return <NoteDocumentEditor formation={sinners.flatMap(sinner => { const id = sinner.id; const identity = deckSlots[id]; return identity ? [{ identityId: identity.id, sinnerId: id, name: (locale === 'en' ? sinner?.name_en : locale === 'ja' ? sinner?.name_jp : sinner?.name_kr) || sinner?.name_kr || id }] : [] })} value={description} onChange={setDescription} preview={descPreview} onPreviewChange={setDescPreview}
    previewContent={<NoteRenderer text={description} skillLookup={skillTokenLookup} passiveLookup={passiveTokenLookup} egoLookup={egoTokenLookup} identityLookup={identityLookup} egoGiftLookup={egoGiftLookup} egoGiftConditionLookup={egoGiftConditionLookup} anchors />} />
}
