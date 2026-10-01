/**
 * Korean descriptions written by hand where the game's own text is not what players need (원호 공격 / 원호 방어). The
 * keywords sync stores them in keyword_meta.description and the site keeps showing that column instead of the one in
 * game_text_refs (lib/keywords/ref-text.ts).
 */
export const KEYWORD_DESCRIPTION_OVERRIDES: Record<string, string> = {
  '원호 공격': '- 이 효과를 부여한 대상의 공격 스킬 종료 시, 부여 대상이 공격한 적을 스킬 1로 일방 공격 함.\n- 원호 공격 시 해당 캐릭터의 사용할 스킬 목록에 영향을 주지 않음.',
  '원호 방어': '- 최댓값 : 3\n- 아군이 적에게 일방공격 당할 때, 수치를 1 소모하여 적의 공격 대상을 자신으로 변경하고, 원호 방어 전용 스킬 사용\n- 원호 방어를 보유한 아군이 여러 명이면, 가장 높은 수치를 가진 아군이 우선 발동\n- 수비 스킬을 장착한 아군에게는 발동하지 않음\n- 턴 종료시 소멸',
}
