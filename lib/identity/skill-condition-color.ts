/** Original aliases: 2026-09-19 KR/EN/JP_SkillTag.json. Explicit colors use
 * ui/ColorCode.json; otherwise retain the site's lifecycle/hit/clash/result palette.
 * Exact tokens only: bracketed status names must never become condition accents.
 */
const CONDITIONS = [
  ["#93f13e", "OnSucceedAttack", "적중시", "On Hit", "的中時"],
  ["#26cfff", "WhenUse", "사용시", "On Use", "使用時"],
  ["#ff7e00", "WinDuel", "합 승리시", "Clash Win", "マッチ勝利時"],
  ["#26cfff", "BeforeAttack", "공격 시작 전", "Before Attack", "攻撃前"],
  ["#ffe71b", "Wide", "광역", "AoE", "広域"],
  ["#ff0000", "CantIdentify", "피아식별불가", "Indiscriminate", "敵味方識別不可"],
  ["#26cfff", "EndSkill", "공격 종료시", "Attack End", "攻撃後"],
  ["#26cfff", "StartBattle", "전투 시작시", "Combat Start", "戦闘開始時"],
  ["#e30000", "DefeatDuel", "합 패배", "Clash Lose", "マッチ敗北"],
  ["#c7ff94", "OnSucceedAttackHead", "앞면 적중시", "Heads Hit", "表面的中時"],
  ["#93f13e", "OnSucceedAttackTail", "뒷면 적중시", "Tails Hit", "裏面的中時"],
  ["#93f13e", "OnSucceedEvade", "회피 성공시", "On Evade", "回避成功時"],
  ["#26cfff", "AlwaysUse", "상시", "Constant", "常時"],
  ["#ff0000", "CantDuel", "합 불가능", "Unclashable", "マッチ不可"],
  ["#ed9a83", "EnemyKill", "적 처치 시", "On Kill", "敵討伐時"],
  ["#ed9a83", "EnemyKillFail", "적 처치 실패 시", "Failed Kill", "敵討伐失敗時"],
  ["#26cfff", "ReUse", "재사용 시", "On Reuse", "再使用時"],
  ["#93f13e", "ReUseOnSucceedAttackHead", "재사용 앞면 적중 시", "Reuse - Heads Hit", "再使用表面的中時"],
  ["#93f13e", "CriticalOnSucceedAttack", "크리티컬 적중 시", "On Crit", "クリティカル的中時"],
  ["#e8c16c", "StartDuel", "합 시작 시", "Clash Start", "マッチ開始時"],
  ["#26cfff", "EndBattle", "턴 종료 시", "Turn End", "ターン終了時"],
  ["#ed9a83", "OnDefeatEvade", "회피 실패시", "Failed Evade", "回避失敗時"],
  ["#ff59c2", "EndSkillHead", "앞면 공격 종료 시", "Heads Attack End", "表面攻撃終了時"],
  ["#cb0080", "EndSkillTail", "뒷면 공격 종료 시", "Tails Attack End", "裏面攻撃終了時"],
  ["#93f13e", "WinDuelAttackHead", "합 승리 후 앞면 적중시", "Heads Hit after Clash Win", "マッチ勝利後表面的中時"],
  ["#93f13e", "WinDuelAttack", "합 승리 후 적중시", "Hit after Clash Win", "マッチ勝利後的中時"],
  ["#93f13e", "CriticalActivated", "크리티컬 발동 시", "On Crit", "クリティカル発動時"],
  ["#ff59c2", "CriticalEndSkill", "크리티컬 공격 종료 시", "Crit Attack End", "クリティカル攻撃終了時"],
  ["#ff0000", "CantChangeTarget", "대상 변경 불가", "Target Fixed", "対象変更不可"],
  ["#26cfff", "TurnStartBattle", "턴 시작 시", "Turn Start", "ターン開始時"],
  ["#26cfff", "EndSkillAll", "스킬 종료시", "Skill End", "スキル終了時"],
  ["#26cfff", "WhenUse_Force", "사용시", "On Use", "使用時"],
  ["#93f13e", "StartBattle_Force", "전투 시작시", "Combat Start", "戦闘開始時"],
  ["#ed9a83", "TargetKill", "대상 처치 시", "On Target Kill", "対象討伐時"],
  ["#ed9a83", "CriticalTargetKill", "크리티컬 처치 시", "On Crit Kill", "クリティカル討伐時"],
  ["#26cfff", "BeforeUse", "사용전", "Before Use", "使用前"],
  ["#ff6000", "DuelCounter", "합 가능 반격", "Clashable Counter", "マッチ可能反撃"],
  ["#e8c16c", "DuelGuard", "합 가능 가드", "Clashable Guard", "マッチ可能ガード"],
  ["#26cfff", "WhenUseEvade", "회피 사용시", "On Evade Use", "回避使用時"],
  ["#26cfff", "EndCoin", "이 코인 공격 종료 시", "Current Coin Attack End", "このコインの攻撃終了時"],
  ["#ed9a83", "CriticalEnemyTargetKillFail", "크리티컬 적 처치 실패 시", "On Crit Kill Fail Against Enemy", "クリティカル敵討伐失敗時"],
  ["#ed9a83", "CriticalEnemyTargetKill", "크리티컬 적 처치 시", "On Crit Kill Against Enemy", "クリティカル敵討伐時"],
  ["#93f13e", "DefeatDuelAttack", "합 패배 후 적중", "Hit after Clash Lose", "マッチ敗北後的中"],
  ["#ed9a83", "TargetKillFail", "대상 처치 실패시", "On Target Kill Fail", "対象討伐失敗時"],
  ["#ed9a83", "AllyKill", "아군 처치 시", "On Ally Kill", "味方討伐時"],
  ["#ed9a83", "AllyKillFail", "아군 처치 실패시", "On Ally Kill Fail", "味方討伐失敗時"],
  ["#93f13e", "UnBrokenCoinOnSucceedAttack", "파괴되지 않고 적중시", "On Hit without Cracking", "破壊されずに的中時"],
  ["#ed9a83", "BeforeHit", "피격 직전", "Before Getting Hit", "被ダメージ直前"],
  ["#26cfff", "OnDirectAttack", "일방 공격 시", "On Unopposed Attack", "一方攻撃時"],
  ["#93f13e", "ReUseOnSucceedAttack", "재사용 적중시", "Reuse - On Hit", "再使用的中時"],
  ["#93f13e", "CriticalOnSucceedAttackHead", "크리티컬 앞면 적중 시", "On Crit - Heads Hit", "クリティカル表面的中時"],
  ["#26cfff", "OnStartCoin", "코인 시작 시", "Coin Start", "コイントス開始時"],
  ["#26cfff", "BeforeBehavior", "행동 시작 전", "Before Action", "行動開始前"],
  ["#26cfff", "AlwaysUseEGOPassive2050911", "검계 우두머리 뫼르소 전용 상시 효과", "Always Active - Blade Lineage Mentor Meursault Exclusive Effect", "剣契頭目 ムルソー専用 常時効果"],
  ["#26cfff", "WhenUseEGOPassive", "사용 효과", "Effect on Use", "使用効果"],
  ["#26cfff", "WinDuelEndSkill", "합 승리 후 공격 종료 시", "Attack End After Clash Win", "マッチ勝利後の攻撃終了時"],
  ["#26cfff", "WhenUseEGOPassive2010911", "로보토미 E.G.O::엄숙한 애도 이상 전용 사용 효과", "Effect on Use - Lobotomy E.G.O::Solemn Lament Yi Sang Exclusive Effect", "ロボトミーE.G.O::厳粛な哀悼イサン 専用効果"],
  ["#26cfff", "AlwaysUseEGOPassive2010911", "로보토미 E.G.O::엄숙한 애도 이상 전용 상시 효과", "Always Active - Lobotomy E.G.O::Solemn Lament Yi Sang Exclusive Effect", "ロボトミーE.G.O::厳粛な哀悼イサン 専用常時効果"],
  ["#26cfff", "AlwaysUseEGOPassive", "상시 효과", "Always Active", "常時効果"],
] as const

const normalize = (text: string) => text.replace(/[\[\]【】\s]/g, '').toLowerCase()
const colors = new Map<string, string>()
for (const [color, ...aliases] of CONDITIONS) for (const alias of aliases) {
  const key = normalize(alias)
  // Force variants share translated text; preserve the normal tag's default color.
  if (!colors.has(key)) colors.set(key, color)
}
for (const [alias, canonical] of Object.entries({
  '사용할때': '사용시', '공격전': '공격 시작 전', '합승리': '합 승리시', '합패배시': '합 패배',
  '합종료시': '합 시작 시', '합불가': '합 불가능', '피격시': '피격 직전',
  'On Critical Hit': 'On Crit', 'On Heads Hit': 'Heads Hit', 'On Tails Hit': 'Tails Hit',
  'On Clash Win': 'Clash Win', 'On Clash Lose': 'Clash Lose', 'On Clash Loss': 'Clash Lose',
  'Clash End': 'Clash Start', 'On Being Hit': 'Before Getting Hit', 'マッチ終了時': 'マッチ開始時',
  'マッチ敗北時': 'マッチ敗北', '被弾時': '피격 직전',
})) colors.set(normalize(alias), colors.get(normalize(canonical))!)

export function skillConditionColor(text: string): string | undefined {
  return colors.get(normalize(text))
}
