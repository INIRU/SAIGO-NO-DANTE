import {expect,it,vi} from 'vitest'
import {markdownToTiptapContent,tiptapContentToMarkdown} from '@/lib/notes/document'
import {isNoteImageUrl} from '@/lib/notes/images'
import {createApiKey,readApiKey,hashApiKey} from '@/lib/developer/keys'
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
