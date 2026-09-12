import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseUnityColorTags, colorizeEventText, replaceEventPlaceholders } from '@/lib/utils/event-text'

it('preserves original colors, nested italics and small or hidden source text', () => {
  const html = renderToStaticMarkup(<>{parseUnityColorTags('<color=#e30000>20 <i>피해</i></color=#e30000><size=75%>작게</size><size=0%>숨김</size>')}</>)
  expect(html).toContain('color:#e30000')
  expect(html).toContain('font-style:italic')
  expect(html).toContain('font-size:75%')
  expect(html).toContain('display:none')
  expect(html).not.toContain('&lt;size')
})
it('escapes unknown tags and dialogue while leaving unmarked text uncolored', () => {
  const html = renderToStaticMarkup(<>{colorizeEventText('<수감자> <script>alert(1)</script> 출혈')}</>)
  expect(html).toBe('&lt;수감자&gt; &lt;script&gt;alert(1)&lt;/script&gt; 출혈')
  expect(html).not.toContain('<script>')
  expect(replaceEventPlaceholders('[{0}]', 'ko')).toBe('[{수감자 이름}]')
  expect(replaceEventPlaceholders('{1}', 'en')).toBe('{Sinner name}')
})
