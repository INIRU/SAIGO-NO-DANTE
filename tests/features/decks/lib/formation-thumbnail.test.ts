import { describe, expect, it } from 'vitest'
import { formationThumbnail } from '@/features/decks/lib/formation-thumbnail'

describe('formationThumbnail', () => {
  it('fills 12 sinners, formation order first, empty sinners as LCB', () => {
    const slots = formationThumbnail([
      { sinner_id: 'outis', folder_name: 'W Corp', game_id: '11105', slot_order: 1 },
      { sinner_id: 'faust', folder_name: 'Zwei', game_id: '10205', slot_order: 0 },
      { sinner_id: 'yi-sang', folder_name: 'Seven', game_id: '10103', slot_order: 99 },
    ])
    expect(slots).toHaveLength(12)
    expect(slots.slice(0, 3).map(s => [s.sinnerId, s.order])).toEqual([['faust', 0], ['outis', 1], ['yi-sang', null]])
    expect(slots[3]).toMatchObject({ sinnerId: 'don-quixote', folderName: 'LCB Sinner', gameId: '10301', placeholder: true })
  })
})
