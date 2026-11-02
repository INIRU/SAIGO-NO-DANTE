import { expect, test } from 'vitest'
import { skillConditionColor } from '../../../lib/identity/skill-condition-color'

test('condition accents ignore affinity and normalize localized brackets', () => {
  for (const tag of ['[사용시]', '[On Use]', '【使用時】']) expect(skillConditionColor(tag)).toBe('#26cfff')
  for (const tag of ['[적중시]', '[크리티컬 적중시]', '[On Crit]', '【的中時】']) expect(skillConditionColor(tag)).toBe('#93f13e')
  expect(skillConditionColor('[합 승리시]')).toBe('#ff7e00')
  expect(skillConditionColor('[출혈]')).toBeUndefined()
})


test('covers compound conditions and source-defined colors across all locales', () => {
  for (const tag of ['[재사용 앞면 적중 시]', '[Reuse - Heads Hit]', '【再使用表面的中時】', '[파괴되지 않고 적중시]', '[On Hit without Cracking]']) expect(skillConditionColor(tag)).toBe('#93f13e')
  for (const tag of ['[크리티컬 공격 종료 시]', '[Crit Attack End]', '【クリティカル攻撃終了時】']) expect(skillConditionColor(tag)).toBe('#ff59c2')
  for (const tag of ['[앞면 적중시]', '[Heads Hit]', '【表面的中時】']) expect(skillConditionColor(tag)).toBe('#c7ff94')
  for (const tag of ['[합 패배]', '[Clash Lose]', '【マッチ敗北】']) expect(skillConditionColor(tag)).toBe('#ff4f42')
  for (const tag of ['[이 코인 공격 종료 시]', '[Before Use]', '【コイントス開始時】', '[WhenUse]']) expect(skillConditionColor(tag)).toBe('#26cfff')
  expect(skillConditionColor('[합 가능 반격]')).toBe('#ff6000')
  expect(skillConditionColor('[대상 처치 실패시]')).toBe('#ed9a83')
  for (const tag of ['[화상]', '[Attack Power Up]', '[호흡]', '[StartXichun]', '[전투 시작시 효과가 있는 키워드]', '[Unbreakable Coin]']) expect(skillConditionColor(tag)).toBeUndefined()
})
