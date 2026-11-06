import { describe, expect, it } from 'vitest'
import { onRunEndScreen, showsRunEndScreen } from '@/features/assist/lib/run-end-screen'

describe('the dungeon end screen', () => {
  it('is its title with one more of its own texts, in each language', () => {
    expect(showsRunEndScreen('탐사 완료 던전 진행도 1층 [HARD] 최종 탐사 구역 시지프의 거울 참여 인격 E.G.O 기프트 보상 수령')).toBe(true)
    expect(showsRunEndScreen('Exploration Complete Last Reached Identities Claim Rewards')).toBe(true)
    expect(showsRunEndScreen('探査完了 最終探索区域 参加人格 報酬を受け取る')).toBe(true)
  })

  it('is not its title alone, nor its button alone', () => {
    expect(showsRunEndScreen('탐사 완료')).toBe(false)
    expect(showsRunEndScreen('보상 수령')).toBe(false)
  })

  it('stays on for a few seconds after a read', () => {
    expect(onRunEndScreen(1000, 3000)).toBe(true)
    expect(onRunEndScreen(1000, 6000)).toBe(false)
    expect(onRunEndScreen(0, 1000)).toBe(false)
  })
})
