'use client'

import { useContext } from 'react'
import { NoteGiftClickContext } from './NoteBlockViewer'
import IdentitySkillFrameCard from '@/features/catalog/components/IdentitySkillFrameCard'
import { PassiveNoteRow } from '@/features/catalog/components/PassiveEffect'
import { type GiftConditionStatus } from '@/lib/planner/gift-condition-status'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import { sinColorOf } from '@/lib/constants/sin'
import type { NoteEgoGiftEntry, NotePassiveEntry, NoteSkillEntry } from '@/features/notes/lib/note-entries'
import NoteFallbackChip from './NoteFallbackChip'

/** The skill card reads its keywords from its own identity (IdentitySkillFrameCard), not from the deck-wide set. */
export function SkillFramePlaceholder({
  entry,
  lang,
}: {
  entry: NoteSkillEntry
  lang: string
}) {
  if (!entry.skill || !entry.skills || !entry.identity) {
    return <NoteFallbackChip type="s" tokenKey={`${entry.sinnerName}:${entry.skill_order}`} />
  }

  return (
    <div
      style={{
        margin: '0.75rem 0',
        width: '100%',
        maxWidth: '44rem',
      }}
    >
      <IdentitySkillFrameCard
        skill={entry.skill}
        skills={entry.skills}
        identity={entry.identity}
        lang={lang}
        size="4.5rem"
        className="rounded-md p-2.5"
        style={{
          background: 'rgba(12,10,7,0.9)',
          border: `1px solid ${sinColorOf(entry.sin_affinity, '#888888')}33`,
        }}
      />
    </div>
  )
}

export function PassiveBlockPlaceholder({ entry }: { entry: NotePassiveEntry }) {
  return (
    <div style={{ margin: '0.75rem 0' }}>
      <PassiveNoteRow
        passive={{
          identity_id: entry.sinnerName,
          name: entry.name,
          passive_type: 'battle',
          sin_affinity: entry.sin_affinity,
          sin_count: entry.sin_count,
          sin_requirements: entry.sin_requirements,
          active_cond: entry.active_cond,
          description: entry.description,
        }}
        imageUrl={entry.imageUrl}
      />
    </div>
  )
}

export function GiftCardPlaceholder({
  entry,
  conditionStatus,
}: {
  entry: NoteEgoGiftEntry
  conditionStatus?: GiftConditionStatus | null
}) {
  const onGiftClick = useContext(NoteGiftClickContext)
  return (
    <div
      style={{
        display: 'inline-block',
        width: '4.75rem',
        margin: '0.75rem 0',
        verticalAlign: 'top',
      }}
    >
      <GiftCard gift={entry} onClick={() => onGiftClick?.(entry.name)} conditionStatus={conditionStatus} />
    </div>
  )
}
