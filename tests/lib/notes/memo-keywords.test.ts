import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ESCAPE_MARK, convertMemoKeywords, memoKeywordIndex } from '@/lib/notes/memo-keywords'
import { NOTE_PREFIX, parseBlockDocument } from '@/lib/notes/blocks'
import { CATALOG, MATCH_CASES } from '../../fixtures/memo-keywords/cases'

const index = memoKeywordIndex(CATALOG)
const convert = (value: string) => convertMemoKeywords(value, index)
const doc = (...content: object[]) => NOTE_PREFIX + JSON.stringify({ type: 'doc', content })
const paragraph = (...content: object[]) => ({ type: 'paragraph', content })
const text = (value: string, marks?: object[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const chip = (id: string) => ({ type: 'noteKeyword', attrs: { id } })
const read = (value: string) => JSON.parse(value.slice(NOTE_PREFIX.length))
const SRC = 'https://example.supabase.co/storage/v1/object/public/limbus-assets/notes/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp'

beforeAll(() => { vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co') })

describe('REQ-DECKS-011 old plain memos become explicit [k:] tokens', () => {
  it('REQ-DECKS-011 turns the words the guess drew as keywords into tokens and keeps the rest', () => {
    const result = convert('화상 3 부여, 못을 박는다. 못하는 안못해')
    expect(result.value).toBe('[k:화상] 3 부여, [k:못]을 박는다. 못하는 안못해')
    expect(result).toMatchObject({ changed: true, format: 'text', chips: 2, escapes: 0 })
  })

  it('REQ-DECKS-011 picks the longest keyword first', () => {
    expect(convert('진동 폭발 3, 진동 2').value).toBe('[k:진동 폭발] 3, [k:진동] 2')
  })

  it('REQ-DECKS-011 reads headings, quotes and list items like the renderer does, line by line', () => {
    const memo = ['## 화상 운용', '> 못 박기', '- 출혈 2 부여', '1. 충전을 쌓는다', '', '평문 화상'].join('\r\n')
    expect(convert(memo).value).toBe(['## [k:화상] 운용', '> [k:못] 박기', '- [k:출혈] 2 부여', '1. [k:충전]을 쌓는다', '', '평문 [k:화상]'].join('\r\n'))
  })

  it('REQ-DECKS-011 leaves links, code, images, existing tokens and cards alone', () => {
    const memo = [`[화상 가이드](https://example.test/a)`, '`화상` 코드', `![화상](${SRC})`, '[s:화상:1] [p:출혈] 입니다', '{{skill:화상:1}}', '{{passive:출혈}}'].join('\n')
    expect(convert(memo)).toMatchObject({ value: memo, changed: false, chips: 0 })
  })

  it('REQ-DECKS-011 converts the text around existing tokens, and never reads inside them', () => {
    expect(convert('[k:출혈] 화상 [g:화상 장갑] 못 박기').value).toBe('[k:출혈] [k:화상] [g:화상 장갑] [k:못] 박기')
  })

  it('REQ-DECKS-011 keeps a keyword inside bold or italic text bold by closing and reopening the markup around the token', () => {
    expect(convert('**화상 3 부여**').value).toBe('[k:화상]** 3 부여**')
    expect(convert('**화상**').value).toBe('[k:화상]')
    expect(convert('**주의: 화상 3**과 *충전 시* 그리고 _못 박기_').value).toBe('**주의: **[k:화상]** 3**과 [k:충전]* 시* 그리고 [k:못]_ 박기_')
    expect(convert('**일반** 글').changed).toBe(false)
  })

  it('REQ-DECKS-011 writes the Korean name for English and Japanese names (a memo with no Hangul)', () => {
    const result = convert('Inflict 3 Burn and Bleed, then [Combustion]')
    expect(result.value).toBe('Inflict 3 [k:화상] and [k:출혈], then [k:화상]')
    expect(result.byLocale).toEqual({ ko: 0, en: 3, ja: 0 })
    const japanese = convert('火傷を与え、出血と呼吸')
    expect(japanese.value).toBe('[k:화상]を与え、[k:출혈]と[k:호흡]')
    expect(japanese.byLocale).toEqual({ ko: 0, en: 0, ja: 3 })
  })

  it('REQ-DECKS-011 reads a memo that has Hangul with the Korean names only, as a Korean viewer saw it', () => {
    expect(convert('Burn 화상 Poise').value).toBe('Burn [k:화상] Poise')
  })

  it('REQ-DECKS-011 keeps an escaped keyword as plain text: the backslash becomes an invisible word joiner', () => {
    const result = convert('흑수 \\못 넣을시, \\\\\\화상, 못')
    expect(result.value).toBe(`흑수 ${ESCAPE_MARK}못 넣을시, \\\\${ESCAPE_MARK}화상, [k:못]`)
    expect(result.escapes).toBe(2)
    expect(result.value).not.toContain('\\못')
  })

  it('REQ-DECKS-011 converts nothing in an empty memo and reports it unchanged', () => {
    expect(convert('')).toMatchObject({ value: '', changed: false })
    expect(convert('화상 없음 그냥 글').changed).toBe(true)
    expect(convert('keyword 없는 글').changed).toBe(false)
  })

  it('REQ-DECKS-011 converts exactly the keywords the old renderer drew, for every recorded Korean case', () => {
    for (const item of MATCH_CASES.filter(item => item.locale === 'ko')) {
      const ids = [...convert(item.text).value.matchAll(/\[k:([^\]]+)\]/g)].map(match => match[1])
      expect(ids, JSON.stringify(item.text)).toEqual(item.keywords)
    }
  })

  it('REQ-DECKS-011 is idempotent: a second run changes nothing, also next to chips and after escapes', () => {
    const samples = [
      ...MATCH_CASES.map(item => item.text),
      '화상이못', '못 화상', '화상 못', '화상 3 못', '**화상 3 부여** 와 *못*', '- 못\n- 화상\n\n> 출혈', '흑수 \\못 넣을시',
      'Burn Bleed Burning', '火傷 出血 \\出血', '[k:화상]못', '못[k:화상]', '[k:화상]이못 화상출혈', '**a 화상 b** `화상` [x](https://a.test)',
    ]
    for (const sample of samples) {
      const once = convert(sample)
      const twice = convert(once.value)
      expect(twice.changed, JSON.stringify(sample)).toBe(false)
      expect(twice.value).toBe(once.value)
    }
  })
})

describe('REQ-DECKS-011 old block documents become noteKeyword nodes', () => {
  it('REQ-DECKS-011 splits a text node into text and chips and keeps its marks on every part', () => {
    const result = convert(doc(paragraph(text('적에게 화상 3 부여 후 못', [{ type: 'bold' }]), text(' 그리고 출혈', [{ type: 'italic' }]))))
    expect(read(result.value).content[0].content).toEqual([
      text('적에게 ', [{ type: 'bold' }]), chip('화상'), text(' 3 부여 후 ', [{ type: 'bold' }]), chip('못'),
      text(' 그리고 ', [{ type: 'italic' }]), chip('출혈'),
    ])
    expect(result).toMatchObject({ changed: true, format: 'blocks', chips: 3 })
    expect(parseBlockDocument(result.value)).not.toBeNull()
  })

  it('REQ-DECKS-011 leaves existing chips, code, links, code blocks, assets and unmatched text untouched', () => {
    const source = doc(
      paragraph(text('화상 가이드', [{ type: 'link', attrs: { href: 'https://example.test/' } }]), text('화상', [{ type: 'code' }]), chip('출혈'), text('[k:충전]')),
      { type: 'codeBlock', content: [text('화상 \\못')] },
      { type: 'noteAsset', attrs: { kind: 'sin', id: '화상' } },
      paragraph(text('평범한 글')),
    )
    expect(convert(source)).toMatchObject({ value: source, changed: false, chips: 0 })
  })

  it('REQ-DECKS-011 reaches headings, lists, quotes and accordion titles and bodies', () => {
    const source = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('화상 운용')] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('못 박기'))] }] },
      { type: 'blockquote', content: [paragraph(text('출혈 2'))] },
      { type: 'noteAccordion', content: [{ type: 'noteTitle', content: [text('충전 정리')] }, { type: 'noteBody', content: [paragraph(text('호흡 3'))] }] },
    )
    const result = convert(source)
    expect(result.chips).toBe(5)
    const json = JSON.stringify(read(result.value))
    for (const id of ['화상', '못', '출혈', '충전', '호흡']) expect(json).toContain(`{"type":"noteKeyword","attrs":{"id":"${id}"}}`)
    expect(read(result.value).content[3].content[0].content[0]).toEqual(chip('충전'))
  })

  it('REQ-DECKS-011 reads a chip next to the text for the boundary rules', () => {
    // "이못": the "못" follows a Korean syllable, so it was never a keyword, also when a chip stands before the text.
    const source = doc(paragraph(chip('화상'), text('이못'), chip('출혈')))
    expect(convert(source).changed).toBe(false)
  })

  it('REQ-DECKS-011 turns literal markdown inside a text node into marks when a keyword is in it, and leaves other text as typed', () => {
    const result = convert(doc(paragraph(text('앞 **화상 3** 뒤 `화상` 와 **글**'))))
    expect(read(result.value).content[0].content).toEqual([
      text('앞 '), chip('화상'), text(' 3', [{ type: 'bold' }]), text(' 뒤 `화상` 와 **글**'),
    ])
  })

  it('REQ-DECKS-011 keeps escaped words as text with the joiner, in blocks too', () => {
    const result = convert(doc(paragraph(text('흑수 \\못 넣을시'))))
    expect(read(result.value).content[0].content).toEqual([text(`흑수 ${ESCAPE_MARK}못 넣을시`)])
    expect(result.escapes).toBe(1)
  })

  it('REQ-DECKS-011 is idempotent for block documents', () => {
    const samples = [
      doc(paragraph(text('적에게 화상 3 부여 후 못', [{ type: 'bold' }]), text(' 그리고 출혈'))),
      doc(paragraph(text('앞 **화상 3** 뒤'), chip('출혈'), text('못'))),
      doc(paragraph(text('Inflict 3 Burn and Bleed'))),
      doc(paragraph(text('화상이못'), text('\\못 화상'))),
      doc({ type: 'noteAccordion', content: [{ type: 'noteTitle', content: [text('충전')] }, { type: 'noteBody', content: [paragraph(text('호흡'))] }] }),
    ]
    for (const sample of samples) {
      const once = convert(sample)
      const twice = convert(once.value)
      expect(twice.changed).toBe(false)
      expect(twice.value).toBe(once.value)
    }
  })

  it('REQ-DECKS-011 does not touch a block document it cannot read', () => {
    const broken = NOTE_PREFIX + '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"화상"'
    expect(convert(broken)).toMatchObject({ value: broken, changed: false, format: 'invalid' })
  })
})
