import {expect,it,vi} from 'vitest'
import {markdownToTiptapContent,tiptapContentToMarkdown} from '@/features/notes/lib/document'
import {isNoteImageUrl} from '@/lib/notes/images'
import {createApiKey,readApiKey,hashApiKey} from '@/features/account/server/developer-keys'
it('preserves Korean paragraphs, format and safe uploaded image through document editing',()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co')
 const src='https://example.supabase.co/storage/v1/object/public/limbus-assets/notes/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp'
 const md=`## 운용 순서\n\n갂 뷁 힣 한글 메모\n![공략](${src})\n\n- **핵심** 기프트`
 expect(tiptapContentToMarkdown(markdownToTiptapContent(md))).toBe(md)
 expect(isNoteImageUrl('https://evil.test/pixel.png')).toBe(false)
 expect(isNoteImageUrl(src+'?secret=x')).toBe(false)
 expect(markdownToTiptapContent('> ').content?.[0].content?.[0].content).toEqual([])
 vi.unstubAllEnvs()
})
it('stores only a key hash and accepts strict Bearer credentials',()=>{
 const {key,key_hash,prefix}=createApiKey()
 expect(key_hash).toBe(hashApiKey(key));expect(prefix).not.toBe(key)
 expect(readApiKey(`Bearer ${key}`)).toBe(key)
 expect(readApiKey(`Bearer ${key} extra`)).toBeNull()
 expect(readApiKey(null)).toBeNull()
})

import { NOTE_PREFIX, newBlock, parseBlockDocument, normalizeDocument, visibleNode, youtubeId, assetRefs, notePlainText } from '@/lib/notes/blocks'
it('round trips nested visual blocks, omits empty placeholders and keeps stable asset references', () => {
 const accordion = newBlock('accordion')
 expect(visibleNode(accordion)).toBe(false)
 accordion.content![0].content = [{type:'text',text:'추천 기프트',marks:[{type:'bold'}]}]
 accordion.content![1].content = [newBlock('gift'),{type:'noteAsset',attrs:{kind:'theme',id:'42'}},{type:'paragraph',content:[{type:'text',text:'한글 조합 공략'}]}]
 const doc = {type:'doc',content:[accordion,newBlock('youtube')]}
 const saved=tiptapContentToMarkdown(doc)
 expect(saved.startsWith(NOTE_PREFIX)).toBe(true)
 expect(markdownToTiptapContent(saved)).toEqual(normalizeDocument(doc))
 expect(assetRefs(parseBlockDocument(saved)!)).toBe('[{"kind":"theme","id":"42"}]')
 expect(saved).not.toContain('여기에')
 expect(notePlainText(saved)).toContain('한글 조합 공략')
 expect(visibleNode(parseBlockDocument(saved)!.content![1])).toBe(false)
})
it('rejects untrusted rich content, oversized nesting, and non-YouTube embeds', () => {
 const doc=normalizeDocument({type:'doc',content:[{type:'script',text:'alert(1)'},{type:'image',attrs:{src:'javascript:alert(1)'}},{type:'noteAsset',attrs:{kind:'evil',id:'x'}},{type:'noteVideo',attrs:{videoId:'../../evil'}},{type:'paragraph',content:[{type:'text',text:'safe',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]})!
 expect(doc.content).toHaveLength(2)
 expect(doc.content![0].attrs?.videoId).toBe('')
 expect(doc.content![1].content![0].marks).toEqual([])
 let nested: object={type:'paragraph'}
 for(let i=0;i<30;i++)nested={type:'blockquote',content:[nested]}
 expect(normalizeDocument({type:'doc',content:[nested]})).toBeNull()
 for(const url of ['https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3','https://youtube.com/shorts/dQw4w9WgXcQ'])expect(youtubeId(url)).toBe('dQw4w9WgXcQ')
 for(const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://evil.test/dQw4w9WgXcQ','javascript:alert(1)','https://youtube.com/playlist?list=x','https://x@youtube.com/watch?v=dQw4w9WgXcQ'])expect(youtubeId(url)).toBeNull()
 expect(parseBlockDocument(NOTE_PREFIX+'{')).toBeNull()
})

it('keeps inline keywords within prose and converts earlier keyword cards',()=>{
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'적에게 '},{type:'noteKeyword',attrs:{id:'화상'}},{type:'text',text:' 5 부여'}]},{type:'noteAsset',attrs:{kind:'keyword',id:'충전'}}]}
 const saved=tiptapContentToMarkdown(doc), loaded=parseBlockDocument(saved)!
 expect(loaded.content![0].content![1]).toEqual({type:'noteKeyword',attrs:{id:'화상'}})
 expect(loaded.content![1]).toEqual({type:'paragraph',content:[{type:'noteKeyword',attrs:{id:'충전'}}]})
 expect(notePlainText(saved)).toContain('화상')
 expect(visibleNode(loaded.content![0].content![1])).toBe(true)
})

it('preserves keyword escapes while editing plain notes',()=>{
 const source='흑수 \\못 넣을시'
 expect(tiptapContentToMarkdown(markdownToTiptapContent(source))).toBe(source)
})
it('keeps a gift written inside a sentence, with its name for plain text and asset lookup',()=>{
 const gift={type:'noteGift',attrs:{id:'9e10fce9-4275-4c8a-8eee-62604e16639b',name:'데스페라도'}}
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'기프트는 '},gift,{type:'text',text:'를 챙깁니다'}]}]}
 const saved=tiptapContentToMarkdown(doc), loaded=parseBlockDocument(saved)!
 expect(loaded.content![0].content![1]).toEqual(gift)
 expect(notePlainText(saved)).toContain('데스페라도')
 expect(JSON.parse(assetRefs(loaded))).toEqual([{kind:'gift',id:gift.attrs.id}])
 expect(parseBlockDocument(tiptapContentToMarkdown({type:'doc',content:[{type:'paragraph',content:[{type:'noteGift',attrs:{id:'x'.repeat(400),name:1}}]}]}))!.content![0].content![0].attrs).toEqual({id:'x'.repeat(150),name:''})
})

import { notePreviewText } from '@/lib/notes/blocks'
it('keeps gifts as tokens in card previews so the preview can draw their icons', () => {
  const saved = tiptapContentToMarkdown({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '먼저 ' }, { type: 'noteGift', attrs: { id: '9772', name: '점화 장갑' } }, { type: 'text', text: ' 챙기기' }] }] })
  expect(notePreviewText(saved)).toContain('[g:점화 장갑]')
  expect(notePlainText(saved)).toContain('점화 장갑')
  expect(notePlainText(saved)).not.toContain('[g:')
  expect(notePreviewText('평문 [g:블러디 가젯] 메모')).toBe('평문 [g:블러디 가젯] 메모')
})
