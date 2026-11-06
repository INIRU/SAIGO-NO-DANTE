import { expect, it } from 'vitest'
import { gameTextPieces, ocrNormalized } from '@/features/assist/lib/text-normalize'
import { columnText, eventScreenEvidence, matchOcrCandidates, type OcrCatalog, type OcrWord } from '@/features/assist/lib/ocr-match'

it('removes Unity rich-text tags and splits game text at placeholders', () => {
  expect(gameTextPieces('<color=#ebcaa2>판정에 실패한 수감자</color> <color=#fe4b48>12만큼 정신력</color> </color=#ebcaa2>피해!</color>'))
    .toEqual(['판정에실패한수감자12만큼정신력피해'])
  expect(gameTextPieces('<b>진동</b> <size=120%>폭발</size> <sprite name="burn" />'))
    .toEqual(['진동폭발'])
  // The name shown for {0} is unknown, so no window spans it.
  expect(gameTextPieces('{0}에게 낡은 열쇠를 건넨다. {1}은 고개를 끄덕였다.')).toEqual(['에게낡은열쇠를건넨다', '은고개를끄덕였다'])
  // Stored tokens ({{sinner}}, {{live}}) hide screen text the same way.
  expect(gameTextPieces('{{sinner}} 수감자가 걷는다. {{live}}번째')).toEqual(['수감자가걷는다', '번째'])
  // Unknown angle-bracket dialogue is text on screen too.
  expect(gameTextPieces('<살려줘>')).toEqual(['살려줘'])
})

it('folds Japanese glyphs OCR swaps on both sides, leaving Korean and Latin text alone', () => {
  expect(ocrNormalized('カジノプアー')).toBe(ocrNormalized('カジノブア'))
  expect(ocrNormalized('ロッカー')).toBe(ocrNormalized('口ツカ一'))
  expect(ocrNormalized('シャッター')).toBe(ocrNormalized('ツヤツタ'))
  expect(ocrNormalized('녹슨 커터나이프')).toBe('녹슨커터나이프')
  expect(ocrNormalized('E.G.O Gift')).toBe('egogift')
})

const word = (text: string, left: number, top: number, width = text.length * 20, height = 24): OcrWord =>
  ({ text, confidence: 95, left, top, width, height })

it('reads a two-column screen passage by passage instead of interleaving its lines', () => {
  const words = [
    word('붉은 창문 뒤에서 이상한', 100, 600), word('문을 연다.', 1300, 610),
    word('음악 소리가 들려온다.', 100, 640), word('지나간다.', 1300, 700),
  ]
  expect(columnText(words)).toBe('붉은창문뒤에서이상한음악소리가들려온다|문을연다|지나간다')
  // Words of one line (Tesseract) join into the row before columns are formed.
  expect(columnText([word('붉은', 100, 600, 40), word('창문', 150, 601, 40), word('뒤에서', 200, 599, 60)])).toBe('붉은창문뒤에서')
})

it('names an event whose stored text carries color tags and a sinner placeholder', () => {
  const catalog: OcrCatalog = {
    gifts: [],
    events: [{ id: 'e', texts: ['<color=#ebcaa2>{0}</color>은(는) 녹슨 철문 앞에서 <b>낡은 열쇠</b>를 주웠다. 문 너머에서 누군가 흐느끼는 소리가 들린다.'] }],
    choices: [
      { id: 'c1', eventId: 'e', texts: ['<color=#ebcaa2>열쇠로 철문을 연다</color>'], resultTexts: ['<color=#fe4b48>12만큼 정신력</color> <color=#ebcaa2>피해!</color> 문 너머에는 아무도 없었다.'] },
      { id: 'c2', eventId: 'e', texts: ['{0}에게 열쇠를 맡긴다'] },
    ],
  }
  const screen = { text: '이상은(는) 녹슨 철문 앞에서 낡은 열쇠를 주웠다. 문 너머에서 누군가 흐느끼는 소리가 들린다.\n열쇠로 철문을 연다\n이상에게 열쇠를 맡긴다', words: [] }
  const matches = matchOcrCandidates(screen, catalog)
  expect(matches.events.map(event => event.id)).toEqual(['e'])
  expect(matches.choices.map(choice => choice.id)).toEqual(['c1', 'c2'])
  expect(eventScreenEvidence(screen, catalog).bodyEventIds).toEqual(['e'])
  // The result page is recognized through its tagged result text.
  expect(eventScreenEvidence({ text: '12만큼 정신력 피해! 문 너머에는 아무도 없었다.', words: [] }, catalog).outcomeEventIds).toEqual(['e'])
})

it('names an event from its column when choice lines interleave the passage', () => {
  const catalog: OcrCatalog = {
    gifts: [], choices: [],
    events: [
      { id: 'rest', texts: ['낡은 벤치 위에 누군가 남기고 간 담요가 곱게 개어져 있다.'] },
      { id: 'other', texts: ['젖은 골목 끝에서 희미한 종소리가 반복해서 들려온다.'] },
    ],
  }
  const words = [word('낡은 벤치 위에 누군가', 100, 600), word('잠시 쉬어간다', 1300, 610),
    word('남기고 간 담요가', 100, 640), word('무시하고 떠난다', 1300, 650), word('곱게 개어져 있다.', 100, 680)]
  const text = [...words].sort((first, second) => first.top - second.top).map(item => item.text).join('\n')
  expect(matchOcrCandidates({ text, words }, catalog).events.map(event => event.id)).toEqual(['rest'])
  // Without positions the interleaved lines break every 18-glyph window.
  expect(matchOcrCandidates({ text, words: [] }, catalog).events).toEqual([])
})

it('matches Japanese text through the glyphs OCR swaps', () => {
  const catalog: OcrCatalog = {
    gifts: [{ id: 'g', texts: ['ガラスのロッカー'] }],
    events: [], choices: [],
  }
  expect(matchOcrCandidates({ text: 'カラスの口ツカ一', words: [] }, catalog).gifts).toEqual([{ id: 'g', score: 1 }])
})
