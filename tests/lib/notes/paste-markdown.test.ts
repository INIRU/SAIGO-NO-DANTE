import { describe, expect, it } from 'vitest'
import { isRichClipboardHtml, pastedMarkdownContent } from '@/lib/notes/document'

const types = (text: string) => pastedMarkdownContent(text)?.map(n => n.type)

describe('REQ-COMMUNITY-055 pasting markdown', () => {
  it('REQ-COMMUNITY-055 turns headings, quotes and lists into blocks', () => {
    expect(types('# 운용 순서\n\n- 첫 턴 방어\n- 둘째 턴 공격\n\n> 주의: 광기')).toEqual(['heading', 'paragraph', 'bulletList', 'paragraph', 'blockquote'])
    const heading = pastedMarkdownContent('## 핵심 기프트')![0]
    expect(heading).toMatchObject({ type: 'heading', attrs: { level: 2 } })
  })
  it('REQ-COMMUNITY-055 turns a numbered list and keeps bold inside it', () => {
    const [list] = pastedMarkdownContent('1. **방어** 먼저\n2. 공격')!
    expect(list.type).toBe('orderedList')
    expect(list.content![0].content![0].content![0]).toMatchObject({ text: '방어', marks: [{ type: 'bold' }] })
  })
  it('REQ-COMMUNITY-055 drops the empty lines before and after, and CRLF line ends work', () => {
    expect(types('\n\n# 제목\r\n본문\r\n\n')).toEqual(['heading', 'paragraph'])
  })
  it('REQ-COMMUNITY-055 leaves prose alone, even with a # or - in the middle of a line', () => {
    expect(pastedMarkdownContent('그냥 한 줄')).toBeNull()
    expect(pastedMarkdownContent('첫 줄\n둘째 줄\n\n셋째 문단')).toBeNull()
    expect(pastedMarkdownContent('팀 #1 편성 - 안정적')).toBeNull()
    expect(pastedMarkdownContent('#해시태그 같은 글')).toBeNull()
    expect(pastedMarkdownContent('-5% 감소')).toBeNull()
    expect(pastedMarkdownContent('')).toBeNull()
  })
  it('REQ-COMMUNITY-055 leaves a copied note document to the plain paste', () => {
    expect(pastedMarkdownContent('!limbus-note:v1\n{"type":"doc","content":[]}')).toBeNull()
  })
})

describe('REQ-COMMUNITY-055 clipboard HTML', () => {
  it('REQ-COMMUNITY-055 a web page or document copy is rich, a code editor copy is not', () => {
    expect(isRichClipboardHtml('<h2>제목</h2><p>글</p>')).toBe(true)
    expect(isRichClipboardHtml('<ul><li>항목</li></ul>')).toBe(true)
    expect(isRichClipboardHtml('<meta charset="utf-8"><div style="font-family: Menlo"><div><span style="color:#fff"># 제목</span></div><div><br></div></div>')).toBe(false)
    expect(isRichClipboardHtml('')).toBe(false)
  })
})
