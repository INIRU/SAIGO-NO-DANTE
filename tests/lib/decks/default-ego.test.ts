import { describe, expect, it } from 'vitest'
import { DEFAULT_EGO_NAMES } from '@/lib/decks/default-ego'
import { MANUAL_ATTACK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'

describe('DEFAULT_EGO_NAMES', () => {
  it('keeps the names the deck builder and the planner deck tab each listed by hand', () => {
    expect(DEFAULT_EGO_NAMES).toEqual({
      '이상': '오감도',
      '파우스트': '표사 방출기',
      '돈키호테': '라 상그레 산초',
      '료슈': '삼라영삼',
      '뫼르소': '타인의 사슬',
      '홍루': '허환경',
      '이스마엘': '작살박이',
      '오티스': '토 파토스 마토스',
      '그레고르': '어느날 갑자기',
    })
  })
})

describe('MANUAL_ATTACK_MAIN_KEYWORDS', () => {
  it('is the three attack types a deck can mark as a main keyword by hand', () => {
    expect([...MANUAL_ATTACK_MAIN_KEYWORDS]).toEqual(['참격', '관통', '타격'])
  })
})
