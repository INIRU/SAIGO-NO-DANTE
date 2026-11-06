import { describe, expect, it } from 'vitest'
import { noteShopDialog, screenTags } from '@/features/assist/hooks/useAssistCapture'

describe('the log of the screens a verdict hangs on', () => {
  it('tags a shop purchase confirmation and the acquisition after it (2026-11-04 log text)', () => {
    expect(screenTags('상점 키워드 485 E.G.O 기프트 구매 485 334 [편성 4번 인격 전용 효과]')).toContain('purchase-dialog')
    // read as the log had it, "O" misread
    expect(screenTags('상점 334 E.G.이 기프트를 획득했습니다 NEW')).toContain('acquired-header')
    expect(screenTags('LimbusCompany 상점 새로고침 키워드 485 이스마엘 스킬 교체')).toEqual([])
  })
  it('one confirmation is one dialog while its sightings are under 3 s apart', () => {
    let dialogs = noteShopDialog([], 'purchase', 1000)
    dialogs = noteShopDialog(dialogs, 'purchase', 2500)
    expect(dialogs).toEqual([{ kind: 'purchase', firstAt: 1000, lastAt: 2500 }])
    dialogs = noteShopDialog(dialogs, 'purchase', 9000)
    expect(dialogs).toHaveLength(2)
  })
})
