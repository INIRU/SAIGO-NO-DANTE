import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import { NAV_GROUPS } from '@/components/layout/nav-shared'

const group = (labelKey: string) => NAV_GROUPS.find(entry => entry.labelKey === labelKey)!.items

it('REQ-SHARED-036 lists analysis under tools, not under other, named in every locale', () => {
  expect(group('nav.tools.title')).toContainEqual({ href: '/meta', labelKey: 'nav.tools.meta' })
  expect(group('nav.other.title').map(item => item.href)).not.toContain('/meta')
  expect([ko, en, ja].map(messages => (messages.nav.tools as Record<string, string>).meta)).toEqual(['분석', 'Analysis', '分析'])
})
