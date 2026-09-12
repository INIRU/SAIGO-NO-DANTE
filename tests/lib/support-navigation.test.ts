import {it,expect} from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
it('provides the support navigation label in every public locale',()=>{
 expect(ko.nav.support).toBe('문의')
 expect(en.nav.support).toBe('Support')
 expect(ja.nav.support).toBe('お問い合わせ')
 for (const messages of [ko,en,ja]) expect(messages.nav.community).not.toHaveProperty('support')
})
