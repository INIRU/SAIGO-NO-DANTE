import type { KeywordInfo } from '@/lib/keywords/catalog'

/** A small catalog with names in three languages (the matcher and the old renderer read the same index of it). */
export const CATALOG: Record<string, KeywordInfo> = {
  못: { desc: '', nameEn: 'Nail', nameJp: '釘' },
  화상: { desc: '', nameEn: 'Burn', nameJp: '火傷' },
  출혈: { desc: '', nameEn: 'Bleed', nameJp: '出血' },
  진동: { desc: '', nameEn: 'Vibration', nameJp: '振動' },
  '진동 폭발': { desc: '', nameEn: 'Vibration Explosion', nameJp: '振動爆発' },
  충전: { desc: '', nameEn: 'Charge', nameJp: '充電' },
  호흡: { desc: '', nameEn: 'Poise', nameJp: '呼吸' },
}

export type MatchCase = {
  name: string
  locale: 'ko' | 'en' | 'ja'
  text: string
  /** The keywords the old renderer drew as keywords, in order, as they were shown (an `[Id]` bracket shows its inside). */
  keywords: string[]
  /** What the old renderer showed as text (tags stripped); null where placeholder labels make that unstable. */
  visible: string | null
}

/**
 * Expectations recorded from the old guessing renderer (formatSkillDescInner with escapeKeywords) before it was removed:
 * tests/lib/notes/memo-keyword-guess.test.tsx runs the matcher that replaced it against the same table.
 */
export const MATCH_CASES: MatchCase[] = [
  { name: 'a keyword followed by a number', locale: 'ko', text: '화상 3 부여', keywords: ['화상'], visible: '화상 3 부여' },
  { name: 'a keyword followed by a count', locale: 'ko', text: '출혈 횟수 2 부여', keywords: ['출혈'], visible: '출혈 횟수 2 부여' },
  { name: 'a particle after a short keyword', locale: 'ko', text: '화상을 입힌다', keywords: ['화상'], visible: '화상을 입힌다' },
  { name: 'a non-particle syllable after a two-letter keyword', locale: 'ko', text: '화상태', keywords: [], visible: '화상태' },
  { name: 'a one-letter keyword before a space', locale: 'ko', text: '못 박기', keywords: ['못'], visible: '못 박기' },
  { name: 'a one-letter keyword with a particle', locale: 'ko', text: '못을 박는다', keywords: ['못'], visible: '못을 박는다' },
  { name: 'a one-letter keyword inside a word', locale: 'ko', text: '못하는 안못해', keywords: [], visible: '못하는 안못해' },
  { name: 'two short keywords side by side are both rejected', locale: 'ko', text: '화상못', keywords: [], visible: '화상못' },
  { name: 'a one-letter keyword after a Korean letter is rejected even after a matched keyword', locale: 'ko', text: '화상이못', keywords: ['화상'], visible: '화상이못' },
  { name: 'a one-letter keyword after a latin letter', locale: 'ko', text: 'a못', keywords: ['못'], visible: 'a못' },
  { name: 'longest keyword first', locale: 'ko', text: '진동 폭발 3, 진동 2', keywords: ['진동 폭발', '진동'], visible: '진동 폭발 3, 진동 2' },
  { name: 'many keywords in a sentence', locale: 'ko', text: '[합 승리시] 화상 3, 출혈 2 부여. 충전을 쌓는다', keywords: ['화상', '출혈', '충전'], visible: '[합 승리시] 화상 3, 출혈 2 부여. 충전을 쌓는다' },
  { name: 'a bracket is not a keyword for Korean', locale: 'ko', text: '[화상] 3 【출혈】', keywords: [], visible: '[화상] 3 【출혈】' },
  { name: 'an escaped keyword stays plain', locale: 'ko', text: '흑수 \\못 넣을시', keywords: [], visible: '흑수 못 넣을시' },
  { name: 'an escape in the middle of a sentence', locale: 'ko', text: '\\화상 말고 화상', keywords: ['화상'], visible: '화상 말고 화상' },
  { name: 'an escape after a letter', locale: 'ko', text: 'a\\못', keywords: [], visible: 'a못' },
  { name: 'an escape after a keyword', locale: 'ko', text: '화상\\못', keywords: ['화상'], visible: '화상못' },
  { name: 'two backslashes are no escape', locale: 'ko', text: '\\\\못', keywords: ['못'], visible: '\\\\못' },
  { name: 'three backslashes escape and keep two', locale: 'ko', text: '\\\\\\못', keywords: [], visible: '\\\\못' },
  { name: 'a backslash before a word that is no keyword', locale: 'ko', text: '\\foo 화상', keywords: ['화상'], visible: '\\foo 화상' },
  { name: 'a backslash before a keyword the boundary rule rejects stays', locale: 'ko', text: '\\못하는', keywords: [], visible: '\\못하는' },
  { name: 'placeholder tokens are not scanned', locale: 'ko', text: '화상 {{potency}} 부여 (현재 {{live}}%)', keywords: ['화상'], visible: null },
  { name: 'English names, a substring match, no word boundary', locale: 'en', text: 'Inflict 3 Burn, Burning and Bleed', keywords: ['Burn', 'Burn', 'Bleed'], visible: 'Inflict 3 Burn, Burning and Bleed' },
  { name: 'English: the longest name first', locale: 'en', text: 'Vibration Explosion and Vibration', keywords: ['Vibration Explosion', 'Vibration'], visible: 'Vibration Explosion and Vibration' },
  { name: 'English: the Korean name still matches', locale: 'en', text: '화상 and Poise', keywords: ['화상', 'Poise'], visible: '화상 and Poise' },
  { name: 'English: a bracket with a game id is a keyword shown without its brackets', locale: 'en', text: 'Take [Combustion] then [Burn] and [Unknown]', keywords: ['Combustion', 'Burn'], visible: 'Take Combustion then Burn and [Unknown]' },
  { name: 'English: an escaped name stays plain', locale: 'en', text: 'no \\Burn, yes Burn', keywords: ['Burn'], visible: 'no Burn, yes Burn' },
  { name: 'Japanese names', locale: 'ja', text: '火傷を与え、出血と呼吸', keywords: ['火傷', '出血', '呼吸'], visible: '火傷を与え、出血と呼吸' },
  { name: 'Japanese: a bracket with a Korean name', locale: 'ja', text: '【화상】と[Charge]', keywords: ['화상', 'Charge'], visible: '화상とCharge' },
]
