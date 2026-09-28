import { describe, expect, it } from 'vitest'
import { explorationFloor, themeSelectionHeaderFloor } from '@/lib/vision/exploration-match'
import { fusionAnchors, fusionConfirmation, fusionDialogClosed, isFusionSelectionScreen, showsFusionTitle } from '@/lib/vision/fusion-evidence'
import { popupHeaderEvidence, popupPurchaseHeader, showsAcquiredHeader } from '@/lib/vision/popup-evidence'
import { isSellWindow, sellDialog, sellQuestion } from '@/lib/vision/sell-evidence'
import { readSkillExchange } from '@/lib/vision/skill-exchange'

// Full-frame GPU OCR of English and Japanese clients (2026 YouTube runs arx_O1WPFAA and 0d4-R8WAHKQ), misreads kept.
const en = {
  wheel: 'Fuse E.G.O Gift 3337 Recipes Fusion Guide By Tier I E.G.O Gifts Owned Forecasts ? Wishmaking 5 Close Fuse Leave',
  dialog: 'CONNECTING Fuse E.G.O Gift Selected E.G.O Gifts 3/3 Prediction Fuse the selected E.G.O Gifts? Cancel Cofirm ceave',
  popup: 'Acquire E.G.O Gift E.G.O Gift GET! Whenever an ally takes a hit, inflict 3 Sinking on the attacker The Unchosen Cunfirm',
  shop: 'Shop Refresh Keyword 416 Refresh Replace Rodion\'s Skill Reverberation Melted Eyeball Enhance Fuse Sell Gifts Gifts Gifts',
  explore: 'OIBIOOIII 3329 750 Exploring Floor 1 @ Grace of Stars Activated Cost gained Flat-brake Gamblers',
  packs: '7/ NORMAL Refresh 3/3 Pack Search 0 CONNECTING\nSELECT FLOOR 2 THEME PACK\nNORMAL O The COP Nest',
}
const ja = {
  wheel: 'E.G.Oギフト合成 本171851 レシピ 合成ガイド ランク順 保有E.G.Oキフト 予想辅果 中 ? 願いごと ホ5 ×閉じる 合成 出る',
  dialog: 'E.G.Oギフト合成 選択したギフト 3/3 予想 選択したE.G.Oギフトを調合しますか？ ×キャンセル 確認 出る',
  popup: '獲得E.G.Oギフト E.G.Oギフトを獲得しました。 威力または特殊沈潜を付与するスキルが 確認 選択 1/1',
  purchase: 'ショップ 更新 キーワード更新 900 E.G.Oギフト購入 900-643 メキャンセル 購入',
  explore: 'Bke 2×30101e47@3 171843 900 O 1階層探查中 回 i 2 45 218',
  packs: '/NORMAL テーマバック朝源 更新 2/3\n3階層テーマパック選択\nNORMAL',
}

describe('English and Japanese clients', () => {
  it('reads the fusion screen, its dialog and its end in every client', () => {
    for (const client of [en, ja]) {
      expect(showsFusionTitle(client.wheel)).toBe(true)
      expect(isFusionSelectionScreen(client.wheel)).toBe(true)
      expect(isFusionSelectionScreen(client.dialog)).toBe(false)
      expect(fusionConfirmation(client.dialog)).toEqual({ count: 3, capacity: 3 })
      expect(fusionConfirmation(client.wheel)).toBeNull()
      expect(fusionDialogClosed(client.popup, 2000, 0)).toBe(false)
      expect(fusionDialogClosed(client.wheel, 2000, 0)).toBe(true)
    }
    // The shop's "Fuse / Gifts" button is not the fusion screen.
    expect(showsFusionTitle(en.shop)).toBe(false)
    expect(fusionConfirmation('選択したギフト 3/5 選択したE.G.Oギフトを調合しますか？')).toEqual({ count: 3, capacity: 5 })
    expect(isFusionSelectionScreen(`${en.wheel} Spend 5 Starlight to improve Fusion chance? Cancel Confirm`)).toBe(false)
  })

  it('places the dialog slots with each client question width', () => {
    const word = (text: string, left: number, top: number, width: number, height: number) => ({ text, left, top, width, height })
    // English at 1920×1080: the same slots as the Korean layout.
    const english = fusionAnchors([word('Selected E.G.O Gifts', 482, 263, 360, 43), word('Fuse the selected E.G.O Gifts?', 696, 739, 526, 43)])
    expect(english?.questionWidth).toBe(526)
    // Japanese in a game view scaled to 0.857: only the header-to-question distance and the Japanese width agree.
    const japanese = fusionAnchors([word('選択したギフト', 452, 298, 227, 45), word('選択したE.G.Oギフトを調合しますか？', 535, 712, 570, 33)])
    expect(japanese?.questionWidth).toBe(665)
  })

  it('tells the acquisition popup from the purchase dialog', () => {
    for (const popup of [en.popup, ja.popup]) {
      expect(showsAcquiredHeader(popup)).toBe(true)
      expect(popupHeaderEvidence(popup)).toBe(true)
    }
    expect(popupHeaderEvidence('E.G.O Gift GFT!')).toBe(true)
    expect(popupHeaderEvidence('E.G.O Gifts Owned')).toBe(false)
    expect(popupPurchaseHeader(ja.purchase)).toBe(true)
    expect(popupPurchaseHeader('Purchase E.G.O Gifts')).toBe(true)
    expect(showsAcquiredHeader(ja.purchase)).toBe(false)
  })

  it('reads the exploring floor and the pack selection floor', () => {
    expect(explorationFloor(en.explore)).toBe(1)
    expect(explorationFloor(ja.explore)).toBe(1)
    expect(explorationFloor('Exploring Floor 12')).toBe(12)
    expect(explorationFloor(en.packs)).toBeNull()
    expect(themeSelectionHeaderFloor(en.packs)).toBe(2)
    expect(themeSelectionHeaderFloor(ja.packs)).toBe(3)
  })

  it('reads a sale confirmation in each client, after the window title', () => {
    expect(sellDialog('Sell E.G.O Gift 300 Sell [Cigarette Holder] for 150 Cost? Cancel Confirm')).toEqual({ name: 'CigaretteHolder', price: 150 })
    expect(sellDialog('Sell E.G.O Gift 300 Sell Cigarette Holder] for 150 Cost Cancel')).toEqual({ name: 'CigaretteHolder', price: 150 })
    expect(sellDialog('E.G.Oギフト売却 [煙草ホルダー]をコスト150で売却しますか？ キャンセル 確認')).toEqual({ name: '煙草ホルダー', price: 150 })
    expect(sellQuestion('Sell [Cigarette Holder] for 150 Cost?')).toBe(true)
    expect(isSellWindow('Sell E.G.O Gift 300')).toBe(true)
    expect(isSellWindow(en.shop)).toBe(false)
    expect(isSellWindow('E.G.Oギフト売却')).toBe(true)
  })

  it('reads the skill replacement window title in English and Japanese', () => {
    // OCR drops the macrons of Ryōshū ("Ryshu").
    expect(readSkillExchange("Skills Owned\nReplace Ryshu's Skill\nSKILL1x3 SKILL2x2 SKILL3x1")).toEqual({ sinner: 4, current: [3, 2, 1] })
    expect(readSkillExchange('スキル保有状況\nイサンスキル交換\nSKILL1x3 SKILL2x2 SKILL3X1')).toEqual({ sinner: 1, current: [3, 2, 1] })
    // The shop list alone (same wording, no window) is not the window.
    expect(readSkillExchange(en.shop)).toBeNull()
  })
})
