import { expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import { NAV_GROUPS } from '@/components/layout/nav-shared'

const group = (labelKey: string) => NAV_GROUPS.find(entry => entry.labelKey === labelKey)!.items

it('REQ-SHARED-036 lists analysis under tools and has no other group, named in every locale', () => {
  expect(group('nav.tools.title')).toContainEqual({ href: '/meta', labelKey: 'nav.tools.meta' })
  expect(NAV_GROUPS.some(entry => entry.labelKey === 'nav.other.title')).toBe(false)
  expect([ko, en, ja].map(messages => (messages.nav.tools as Record<string, string>).meta)).toEqual(['분석', 'Analysis', '分析'])
})

it('REQ-SHARED-045 puts developers last under tools and random under fun', () => {
  expect(NAV_GROUPS.map(entry => entry.labelKey)).toEqual(['nav.db.title', 'nav.community.title', 'nav.tools.title', 'nav.motion.title', 'nav.fun.title'])
  expect(group('nav.tools.title').at(-1)).toEqual({ href: '/developers', labelKey: 'nav.tools.developers' })
  expect(group('nav.fun.title')).toEqual([{ href: '/random', labelKey: 'nav.fun.random' }, { href: '/prescript', labelKey: 'nav.fun.prescript' }])
  // Each page is listed once across the menu.
  const hrefs = NAV_GROUPS.flatMap(entry => entry.items.map(item => item.href))
  expect(new Set(hrefs).size).toBe(hrefs.length)
})

it('REQ-MOTION-007 puts the motion group left of fun with the skill motion page, named in every locale', () => {
  const labels = NAV_GROUPS.map(entry => entry.labelKey)
  expect(labels.indexOf('nav.motion.title')).toBe(labels.indexOf('nav.fun.title') - 1)
  expect(group('nav.motion.title')).toEqual([{ href: '/motion/skills', labelKey: 'nav.motion.skills' }])
  const nav = (messages: typeof ko) => messages.nav as unknown as Record<string, Record<string, string>>
  expect([ko, en, ja].map(messages => nav(messages).motion.title)).toEqual(['모션', 'Motion', 'モーション'])
})

it('REQ-SHARED-045 names the fun group, random and developer tools in every locale', () => {
  const nav = (messages: typeof ko) => messages.nav as unknown as Record<string, Record<string, string>>
  expect([ko, en, ja].map(messages => nav(messages).fun.title)).toEqual(['재미', 'Fun', 'お楽しみ'])
  expect([ko, en, ja].map(messages => nav(messages).fun.random)).toEqual(['랜덤 편성', 'Random', 'ランダム編成'])
  expect([ko, en, ja].map(messages => nav(messages).tools.developers)).toEqual(['개발자 도구', 'Developer tools', '開発者ツール'])
  // The calendar icon still reads its label from nav.other; nothing else is left there.
  expect([ko, en, ja].map(messages => Object.keys(nav(messages).other))).toEqual([['calendar'], ['calendar'], ['calendar']])
})
