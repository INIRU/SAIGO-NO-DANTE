import { expect, it } from 'vitest'
import { corroboratedChoiceEvent, effectGiftIds, eventScreenEvidence, matchOcrCandidates, type OcrCatalog, type OcrDocument } from '@/features/assist/lib/ocr-match'

const catalog: OcrCatalog = {
  gifts: [
    { id: '11', texts: ['녹슨 커터나이프'] },
    { id: '12', texts: ['안식처'] },
    { id: '13', texts: ['안식처'] },
    { id: '14', texts: ['피'] },
    { id: '15', texts: ['선물', 'Gift'] },
  ],
  events: [
    { id: '100', texts: ['총기가 조립되는 소리와 책장 넘어가는 소리로 가득한 공간.'] },
    { id: '101', texts: ['무언가 전혀 다른 이야기입니다.'] },
  ],
  choices: [
    { id: '200', eventId: '100', texts: ['믿을 수 없다고 말한다.'] },
    { id: '201', eventId: '100', texts: ['직접 쏘고 싶다고 말한다.'] },
    { id: '202', eventId: '101', texts: ['계속'] },
  ],
}

function document(text: string, words: OcrDocument['words'] = []): OcrDocument { return { text, words } }

it('matches visible gift names and distinctive event and choice text without implying a click', () => {
  const result = matchOcrCandidates(document('녹슨 커터나이프\n총기가 조립되는 소리와 책장 넘어가는 소리로 가득한 공간.\n믿을 수 없다고 말한다.'), catalog)
  expect(result.gifts).toEqual([{ id: '11', score: 1 }])
  expect(result.events).toEqual([{ id: '100', score: 1 }])
  expect(result.choices).toEqual([{ id: '200', eventId: '100', score: 1 }])
})

it('abstains on short generic and duplicate text, even with a confident OCR word', () => {
  const words = [{ text: '안식처', confidence: 96, left: 10, top: 10, width: 50, height: 20 }]
  const result = matchOcrCandidates(document('안식처 계속 피 E.G.O GIFT', [...words, { text: 'GIFT', confidence: 98, left: 80, top: 10, width: 40, height: 20 }]), catalog)
  expect(result).toEqual({ gifts: [], events: [], choices: [] })
})

it('requires high confidence for a unique short name and ignores unrelated battle text', () => {
  const unique: OcrCatalog = { ...catalog, gifts: [{ id: '12', texts: ['안식처'] }] }
  expect(matchOcrCandidates(document('안식처', [{ text: '안식처', confidence: 75, left: 0, top: 0, width: 30, height: 10 }]), unique).gifts).toEqual([])
  expect(matchOcrCandidates(document('안식처', [{ text: '안식처', confidence: 96, left: 0, top: 0, width: 30, height: 10 }]), unique).gifts).toEqual([{ id: '12', score: 1 }])
  expect(matchOcrCandidates(document('12 E.G.O DAMAGE 130 COST'), catalog)).toEqual({ gifts: [], events: [], choices: [] })
})

it('does not assign a shared long choice to unrelated events without event-specific text', () => {
  const shared: OcrCatalog = {
    gifts: [],
    events: [
      { id: 'a', texts: ['붉은 창문 뒤에서 이상한 음악 소리가 들려온다.'] },
      { id: 'b', texts: ['푸른 열차 앞에서 아주 오래된 승차권 한 장을 발견했다.'] },
    ],
    choices: [
      { id: 'a1', eventId: 'a', texts: ['한 걸음 더 안으로 들어간다.'] },
      { id: 'b1', eventId: 'b', texts: ['한 걸음 더 안으로 들어간다.'] },
    ],
  }
  expect(matchOcrCandidates(document('한 걸음 더 안으로 들어간다.'), shared).choices).toEqual([])
  expect(matchOcrCandidates(document('푸른 열차 앞에서 아주 오래된 승차권 한 장을 발견했다. 한 걸음 더 안으로 들어간다.'), shared).choices)
    .toEqual([{ id: 'b1', eventId: 'b', score: 1 }])
})

it('ignores a fragment shared by multiple event descriptions', () => {
  const shared: OcrCatalog = {
    gifts: [], choices: [],
    events: [
      { id: 'a', texts: ['달빛이 비치는 방에서 조용히 기다리는 사람이 있다. 붉은 창문이 열린다.'] },
      { id: 'b', texts: ['달빛이 비치는 방에서 조용히 기다리는 사람이 있다. 푸른 문이 열린다.'] },
    ],
  }
  expect(matchOcrCandidates(document('달빛이 비치는 방에서 조용히 기다리는 사람이 있다.'), shared).events).toEqual([])
})

it('matches two distinct gift-specific effect anchors even if the displayed wording changed', () => {
  const effects: OcrCatalog = {
    gifts: [
      { id: '9012', texts: ['오늘의 표정'], effectTexts: ['타격 스킬 또는 나태 속성 스킬로 공격 종료시 적이 사망했으면, 해당 아군이 이번 턴을 제외한 다음 턴부터 2턴 동안 타격 스킬 위력 +2.'] },
      { id: '9014', texts: ['녹슨 기념 주화'], effectTexts: ['단일 코인 공격 스킬 또는 나태 속성의 스킬로 적을 처치한 경우, 다음 턴 동안 해당 아군의 스킬 위력 +1.'] },
    ], events: [], choices: [],
  }
  const result = matchOcrCandidates(document('타격 스킬 또는 나태 속성의 스킬로 적 처치 시, 다음 턴까지 해당 아군의 타격 스킬 위력 +2.'), effects)
  expect(result.gifts).toEqual([{ id: '9012', score: 1 }])
  expect(matchOcrCandidates(document('타격 스킬 또는 나태 속성의 스킬로 적 처치 시'), effects).gifts).toEqual([])
})

it('joins only adjacent confident OCR words for a unique short Korean gift name', () => {
  const catalog: OcrCatalog = { gifts: [{ id: '9017', texts: ['문자 석판'] }], events: [], choices: [] }
  const words = [
    { text: '문자', confidence: 96, left: 309, top: 274, width: 51, height: 26 },
    { text: '석판', confidence: 92, left: 366, top: 274, width: 50, height: 26 },
  ]
  expect(matchOcrCandidates(document('문자 석판', words), catalog).gifts).toEqual([{ id: '9017', score: 1 }])
  expect(matchOcrCandidates(document('문자 석판', [{ ...words[0], confidence: 60 }, words[1]]), catalog).gifts).toEqual([])
  expect(matchOcrCandidates(document('문자 석판', [words[0], { ...words[1], left: 800 }]), catalog).gifts).toEqual([])
})

it('requires the matched event before accepting its short visible choices', () => {
  const local: OcrCatalog = {
    gifts: [],
    events: [{ id: '901002', texts: ['황금빛 나선이 눈앞에서 아주 천천히 회전하는 것을 발견한다.'] }],
    choices: [
      { id: '1', eventId: '901002', texts: ['눈을 떼지 않는다'] },
      { id: '2', eventId: '901002', texts: ['눈을 돌린다'] },
      { id: '3', eventId: '901002', texts: ['나선을 붙잡는다'] },
    ],
  }
  expect(matchOcrCandidates(document('눈을 돌린다 나선을 붙잡는다'), local).choices).toEqual([])
  expect(matchOcrCandidates(document('황금빛 나선이 눈앞에서 아주 천천히 회전하는 것을 발견한다. 눈을 돌린다 나선을 붙잡는다'), local).choices)
    .toEqual([{ id: '2', eventId: '901002', score: 1 }, { id: '3', eventId: '901002', score: 1 }])
})

it('does not call an effect fragment unique when another gift has it at a shifted offset', () => {
  const effects: OcrCatalog = {
    gifts: [
      { id: 'a', texts: [], effectTexts: ['붉은달빛아래시계가멈추고푸른등불아래모두잠든다'] },
      { id: 'b', texts: [], effectTexts: ['한붉은달빛아래시계가멈추고푸른등불아래모두잠든다'] },
    ], events: [], choices: [],
  }
  expect(matchOcrCandidates(document('붉은달빛아래시계가멈추고푸른등불아래모두잠든다'), effects).gifts).toEqual([])
})

it('rejects repeated source fragments seen only once on screen', () => {
  const effects: OcrCatalog = {
    gifts: [{ id: 'a', texts: [], effectTexts: ['Limbus Company 안내문' + '중간 문구 반복 '.repeat(5) + 'Limbus Company'] }],
    events: [], choices: [],
  }
  expect(matchOcrCandidates(document('Limbus Company'), effects).gifts).toEqual([])
})

it('reports popup effect text only for the gift owning two distant unique phrases', () => {
  const effects: OcrCatalog = {
    events: [], choices: [],
    gifts: [
      { id: 'a', texts: [], effectTexts: ['턴 시작 시, 붉은 속성 자원 +1, 나머지 속성의 자원 중 무작위 2종 +1.'] },
      { id: 'b', texts: [], effectTexts: ['스테이지 시작 시, 푸른 속성 자원 +5. 적 사망 시, 오만 속성 자원 +2, 나머지 속성의 자원 중 무작위 2종 +1.'] },
    ],
  }
  expect(effectGiftIds('스테이지 시작 시, 푸른 속성 자원 +5.\n적 사망 시, 오만 속성 자원 +2, 나머지 속성의 자원 중 무작위 2종 +1.', effects))
    .toEqual(['b'])
  expect(effectGiftIds('나머지 속성의 자원 중 무작위 2종 +1.', effects)).toEqual([])
  expect(effectGiftIds('', effects)).toEqual([])
})

const shortChoices: OcrCatalog = {
  gifts: [],
  events: [{ id: 'a', texts: ['붉은 창문 뒤에서 이상한 음악 소리가 들려온다.'] }, { id: 'b', texts: ['푸른 열차 앞에서 승차권을 발견했다.'] }],
  choices: [
    { id: 'a1', eventId: 'a', texts: ['문을 연다.'], resultTexts: ['아무 일도 일어나지 않았다.'] },
    { id: 'a2', eventId: 'a', texts: ['지나간다.'] },
    { id: 'b1', eventId: 'b', texts: ['문을 연다.'], resultTexts: ['열차가 천천히 출발하며 창밖 풍경이 흐려진다.'] },
    { id: 'b2', eventId: 'b', texts: ['승차권을 버린다.'] },
  ],
}

it('keeps short choices as event-scoped evidence without naming an event on their own', () => {
  const screen = document('12:30 문을 연다. 지나간다.')
  expect(matchOcrCandidates(screen, shortChoices).choices).toEqual([])
  const evidence = eventScreenEvidence(screen, shortChoices)
  expect(evidence.scopedChoices.map(choice => choice.id).sort()).toEqual(['a1', 'a2', 'b1'])
  expect(evidence.outcomeEventIds).toEqual([])
})

it('selects the one image- or text-corroborated event and abstains on ambiguity or a result page', () => {
  const { scopedChoices } = eventScreenEvidence(document('문을 연다. 지나간다.'), shortChoices)
  expect(corroboratedChoiceEvent({ choices: [], scopedChoices, corroboratedEventIds: ['a'] })).toBe('a')
  expect(corroboratedChoiceEvent({ choices: [], scopedChoices, corroboratedEventIds: [] })).toBeNull()
  expect(corroboratedChoiceEvent({ choices: [], scopedChoices, corroboratedEventIds: ['a', 'b'] })).toBeNull()
  const outcome = eventScreenEvidence(document('문을 연다. 아무 일도 일어나지 않았다.'), shortChoices)
  expect(outcome.outcomeEventIds).toEqual(['a'])
  expect(corroboratedChoiceEvent({ choices: [], ...outcome, corroboratedEventIds: ['a'] })).toBeNull()
  expect(corroboratedChoiceEvent({ choices: [{ eventId: 'b' }], scopedChoices: [], corroboratedEventIds: ['a'] })).toBeNull()
})

it('names an event from two of its own unique choices or body windows, and abstains when shared or split', () => {
  const catalog: OcrCatalog = {
    gifts: [],
    events: [
      { id: 'rest', texts: ['낡은 벤치 위에 누군가 남기고 간 담요가 곱게 개어져 있다.'] },
      { id: 'other', texts: ['젖은 골목 끝에서 희미한 종소리가 반복해서 들려온다.'] },
    ],
    choices: [
      { id: 'r1', eventId: 'rest', texts: ['잠시 쉬어간다'] },
      { id: 'r2', eventId: 'rest', texts: ['무시하고 떠난다.'] },
      { id: 'o1', eventId: 'other', texts: ['무시하고 떠난다.'] },
      { id: 'o2', eventId: 'other', texts: ['종을 울린다'] },
    ],
  }
  // both options of rest on screen, one shared with other: only rest has both (2026-11-04; it waited for the body text before)
  expect(eventScreenEvidence(document('잠시 쉬어간다 무시하고 떠난다.'), catalog).choiceEventIds).toEqual(['rest'])
  expect(eventScreenEvidence(document('잠시 쉬어간다 종을 울린다'), catalog).choiceEventIds).toEqual([])
  expect(eventScreenEvidence(document('낡은 벤치 위에 누군가 남기고 간 담요'), catalog).bodyEventIds).toEqual(['rest'])
  expect(eventScreenEvidence(document('낡은 벤치 위에 누군'), catalog).bodyEventIds).toEqual([])
  expect(eventScreenEvidence(document('낡은 벤치 위에 누군가 남기고 간 담요 젖은 골목 끝에서 희미한 종소리가 반복해서'), catalog).bodyEventIds).toEqual([])
  const pair: OcrCatalog = { ...catalog, choices: [...catalog.choices, { id: 'r3', eventId: 'rest', texts: ['담요를 덮는다'] }] }
  expect(eventScreenEvidence(document('잠시 쉬어간다 담요를 덮는다'), pair).choiceEventIds).toEqual(['rest'])
})

it('names the choice taken from the result text only it has within its event', () => {
  const taken: OcrCatalog = {
    gifts: [],
    events: [{ id: 'gate', texts: ['녹슨 철문 앞에 낡은 자물쇠가 매달려 있다.'] }],
    choices: [
      { id: 'force', eventId: 'gate', texts: ['문을 부순다'], resultTexts: ['쇠가 비명을 지르며 문이 안쪽으로 쓰러졌다. 먼지가 가라앉는다.'] },
      { id: 'leave', eventId: 'gate', texts: ['돌아간다'], resultTexts: ['발걸음을 돌려 어두운 복도로 되돌아갔다. 먼지가 가라앉는다.'] },
    ],
  }
  expect(eventScreenEvidence(document('쇠가 비명을 지르며 문이 안쪽으로 쓰러졌다.'), taken).outcomeChoiceIds).toEqual(['force'])
  // a sentence both results end with names neither
  expect(eventScreenEvidence(document('먼지가 가라앉는다.'), taken).outcomeChoiceIds).toEqual([])
})

it('an option with several possible results is named by the text its rows share (left panel on the result page)', () => {
  const opening = '손잡이를 붙잡고 온몸의 무게를 실어 힘껏 당겼다.'
  const rows: OcrCatalog = {
    gifts: [],
    events: [{ id: 'gate', texts: ['녹슨 철문 앞에 낡은 자물쇠가 매달려 있다.'] }],
    choices: [
      { id: 'pull-ok', eventId: 'gate', option: 0, texts: ['문을 당긴다'], resultTexts: [`${opening} 문이 열렸다.`] },
      { id: 'pull-no', eventId: 'gate', option: 0, texts: ['문을 당긴다'], resultTexts: [`${opening} 문은 꿈쩍도 하지 않았다.`] },
      { id: 'leave', eventId: 'gate', option: 1, texts: ['돌아간다'], resultTexts: ['발걸음을 돌려 어두운 복도로 되돌아갔다.'] },
    ],
  }
  // the opening both rows of option 0 share, typed out before the outcome: option 0
  expect(eventScreenEvidence(document(opening), rows).outcomeChoiceIds).toEqual(['pull-ok', 'pull-no'])
  // without options known, rows shared text with each other and named nothing
  const unknown = { ...rows, choices: rows.choices.map(({ option: _, ...choice }) => choice) }
  expect(eventScreenEvidence(document(opening), unknown).outcomeChoiceIds).toEqual([])
})

it('names the event whose choices are all on screen though one name is shared with another event', () => {
  const shared: OcrCatalog = {
    gifts: [], events: [{ id: 'a', texts: ['서류 더미가 쌓여 있다.'] }, { id: 'b', texts: ['낯선 이가 말을 건다.'] }],
    choices: [
      { id: 'a1', eventId: 'a', texts: ['사실대로 말한다.'] }, { id: 'a2', eventId: 'a', texts: ['아무것도 아닌 서류라고 한다.'] },
      { id: 'b1', eventId: 'b', texts: ['사실대로 말한다.'] }, { id: 'b2', eventId: 'b', texts: ['자리를 피한다.'] },
    ],
  }
  expect(eventScreenEvidence(document('사실대로 말한다. 아무것도 아닌 서류라고 한다.'), shared).choiceEventIds).toEqual(['a'])
  // the shared name alone, or names of two events: nothing
  expect(eventScreenEvidence(document('사실대로 말한다.'), shared).choiceEventIds).toEqual([])
  expect(eventScreenEvidence(document('아무것도 아닌 서류라고 한다. 자리를 피한다.'), shared).choiceEventIds).toEqual([])
})

it('the terminal’s own order on a shared screen is no button of the game’s list', () => {
  const catalog: OcrCatalog = {
    gifts: [], events: [{ id: 'clock', texts: ['시간을 알리는 종이 넘어질 듯 젖혀졌다.'] }],
    choices: [{ id: 'c0', eventId: 'clock', texts: ['균형을 잡도록 도와준다.'] }, { id: 'c1', eventId: 'clock', texts: ['더욱 젖혀버린다.'] }],
  }
  const words = (lines: [string, number][]) => ({ text: lines.map(([text]) => text).join(String.fromCharCode(10)),
    words: lines.map(([text, left], i) => ({ text, confidence: 90, left, top: 300 + i * 176, width: 300, height: 38 })) })
  const boxes = eventScreenEvidence(words([['균형을 잡도록 도와준다.', 1101], ['더욱 젖혀버린다.', 1101], ['【선택지 「더욱 젖혀버린다」. 골라라】', 120]]), catalog).choiceBoxes
  expect(boxes?.map(box => [box.choiceId, box.left])).toEqual([['c0', 1101], ['c1', 1101]])
})
