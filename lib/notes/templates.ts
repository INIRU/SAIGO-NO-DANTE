import type { JSONContent } from '@tiptap/core'
import type { SinType } from '@/lib/types'

type Lang = 'ko' | 'en' | 'ja'
const lang = (value: string): Lang => value === 'en' || value === 'ja' ? value : 'ko'

// Nodes are written in the shape normalizeDocument gives back, so a saved template reads back equal (the tests check it).
const mark = (type: string, sin?: SinType) => sin ? { type, attrs: { sin } } : { type }
const text = (value: string, ...marks: NonNullable<JSONContent['marks']>): JSONContent => ({ type: 'text', text: value, marks })
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const heading = (level: 1 | 2, value: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(value)] })
const slot = (kind: 'identity' | 'gift'): JSONContent => ({ type: 'noteAsset', attrs: { kind, id: '' } })
const accordion = (title: string, body: string): JSONContent => ({ type: 'noteAccordion', content: [{ type: 'noteTitle', content: [text(title)] }, { type: 'noteBody', content: [p(text(body))] }] })

/** The first template: three headings to fill in. */
export function basicTemplate(language: string): JSONContent[] {
  const titles = { ko: ['운용 순서', '핵심 기프트', '대체 편성'], en: ['Rotation', 'Key gifts', 'Alternatives'], ja: ['運用手順', '重要ギフト', '代替編成'] }[lang(language)]
  return titles.flatMap(title => [heading(2, title), p()])
}

const GUIDE = {
  ko: { overview: '공략 개요', core: '핵심 죄악은 ', wrath: '분노', support: ', 보조는 ', lust: '색욕', middle: '입니다. 첫 턴에는 ', defense: '방어 스킬', end: '을 먼저 씁니다.', identities: '추천 인격', mention: '이름 앞에 @를 붙여 문장 속에 넣을 수 있어요.', gifts: '핵심 기프트', alternatives: '대체 편성', alternativesBody: '상황에 따라 바꿀 편성을 적어 보세요.', caution: '주의할 점', cautionBody: '광기 수치와 적의 약점을 적어 보세요.' },
  en: { overview: 'Overview', core: 'The core sin is ', wrath: 'Wrath', support: ', with ', lust: 'Lust', middle: ' in support. On the first turn, use ', defense: 'defense skills', end: ' first.', identities: 'Recommended identities', mention: 'Type @ before a name to place it inside a sentence.', gifts: 'Key gifts', alternatives: 'Alternatives', alternativesBody: 'Write the formations to swap in for other situations.', caution: 'Watch out for', cautionBody: 'Note the sanity level and the enemy\'s weaknesses.' },
  ja: { overview: '攻略の概要', core: '中心の罪悪は', wrath: '憤怒', support: '、補助は', lust: '色欲', middle: 'です。最初のターンは', defense: '防御スキル', end: 'を先に使います。', identities: 'おすすめ人格', mention: '名前の前に@を付けると文中に入れられます。', gifts: '重要ギフト', alternatives: '代替編成', alternativesBody: '状況に応じて入れ替える編成を書いてみましょう。', caution: '注意点', cautionBody: '正気度と敵の弱点を書いてみましょう。' },
} as const

/**
 * The second template, a guide skeleton that uses what the editor can do: four headings (the reading view then shows a table
 * of contents), sin-coloured and highlighted words, empty identity and gift slots (seen while editing only) and an accordion.
 */
export function guideTemplate(language: string): JSONContent[] {
  const t = GUIDE[lang(language)]
  return [
    heading(1, t.overview),
    p(text(t.core), text(t.wrath, mark('bold'), mark('noteColor', 'wrath')), text(t.support), text(t.lust, mark('bold'), mark('noteColor', 'lust')), text(t.middle), text(t.defense, mark('highlight')), text(t.end)),
    heading(2, t.identities), slot('identity'), p(text(t.mention)),
    heading(2, t.gifts), slot('gift'), p(),
    accordion(t.alternatives, t.alternativesBody),
    heading(2, t.caution), p(text(t.cautionBody)),
  ]
}
