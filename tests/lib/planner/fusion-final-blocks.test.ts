import { describe, expect, it } from 'vitest'

import {
  deriveBlockedFinalFusionMaterialIds,
  parseFinalGiftId,
  parseFinalGiftIds,
} from '../../../lib/planner/fusion'
import type { GiftData, RecipeData } from '../../../lib/planner/types'

function gift(gameId: number, name: string): GiftData {
  return {
    id: String(gameId),
    game_id: gameId,
    name,
    keyword: null,
    grade: '1',
    image_url: null,
    effect_base: null,
    effect_plus: null,
    effect_plusplus: null,
    theme_ids: null,
    activation_condition: null,
  }
}

function recipe(id: string, resultName: string, ingredients: string[]): RecipeData {
  return {
    id,
    result_name: resultName,
    keyword: '',
    ingredients,
  }
}

const gifts = [
  gift(1, '최종 결과'),
  gift(2, '중간 결과'),
  gift(3, '직접 재료'),
  gift(4, '하위 재료 A'),
  gift(5, '하위 재료 B'),
  gift(6, '무관한 기프트'),
]

const giftMap = new Map(gifts.map(item => [item.game_id, item]))

const recipes = [
  recipe('r-final', '최종 결과', ['중간 결과', '직접 재료']),
  recipe('r-nested', '중간 결과', ['하위 재료 A', '하위 재료 B']),
]

describe('parseFinalGiftIds', () => {
  it('parses base, plus, and plusplus final inventory variants', () => {
    expect(parseFinalGiftId('final_1')).toBe(1)
    expect(parseFinalGiftId('final_2_plus')).toBe(2)
    expect(parseFinalGiftId('final_3_plusplus')).toBe(3)
    expect(parseFinalGiftId('observe_4')).toBeNull()

    expect(parseFinalGiftIds(['final_1', 'final_2_plus', 'final_3_plusplus', 'start_4'])).toEqual(
      new Set([1, 2, 3]),
    )
  })
})

describe('deriveBlockedFinalFusionMaterialIds', () => {
  it('blocks direct and nested recipe materials for a selected final fusion result', () => {
    const blocked = deriveBlockedFinalFusionMaterialIds({
      selectedFinalGiftIds: new Set([1]),
      recipes,
      giftMap,
      gifts,
    })

    expect(blocked).toEqual(new Set([2, 3, 4, 5]))
  })

  it('does not block materials when the fusion result is not selected', () => {
    const blocked = deriveBlockedFinalFusionMaterialIds({
      selectedFinalGiftIds: new Set([6]),
      recipes,
      giftMap,
      gifts,
    })

    expect(blocked).toEqual(new Set())
  })

  it('scopes blocking to the currently selected fusion result', () => {
    const blocked = deriveBlockedFinalFusionMaterialIds({
      selectedFinalGiftIds: new Set([2]),
      recipes,
      giftMap,
      gifts,
    })

    expect(blocked).toEqual(new Set([4, 5]))
  })
})
