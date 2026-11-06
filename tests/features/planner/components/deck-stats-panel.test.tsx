import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DeckStatsPanel from '@/features/planner/components/DeckStatsPanel'

vi.mock('@/features/catalog/components/PassivePanel', () => ({ default: () => null }))

it('counts each skill once in the Assist deck stats, not once per uptie row', () => {
  // One identity's rows at upties 1–4 (S3 from uptie 3), as the skills table stores them.
  const skills = [1, 2, 3, 4].flatMap(uptie => [
    { identity_id: 'a', sin_affinity: 'wrath', skill_type: 'slash', skill_order: 1, variant_order: 1, uptie_level: uptie },
    { identity_id: 'a', sin_affinity: 'lust', skill_type: 'pierce', skill_order: 2, variant_order: 2, uptie_level: uptie },
    ...(uptie >= 3 ? [{ identity_id: 'a', sin_affinity: 'gloom', skill_type: 'slash', skill_order: 3, variant_order: 3, uptie_level: uptie }] : []),
    { identity_id: 'a', sin_affinity: 'pride', skill_type: 'evade', skill_order: 4, variant_order: 4, uptie_level: uptie },
  ])
  const html = renderToStaticMarkup(<DeckStatsPanel identitySlots={[{ identity_id: 'a', sinner_id: 'yi-sang' }]} skills={skills} passives={[]} sinners={[]} />)
  const counts = [...html.matchAll(/deck-stats-attack-count"[^>]*>(\d+)</g)].map(match => Number(match[1]))
  expect(counts).toEqual([2, 1, 0])
})
