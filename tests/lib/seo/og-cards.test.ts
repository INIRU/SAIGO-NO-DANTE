import { describe, expect, it } from 'vitest'
import { OG_SECTIONS, ogCardPath } from '@/lib/seo/og-cards'
import { pageMetadata } from '@/lib/seo/metadata'

describe('REQ-SHARED-110 share cards', () => {
  it('REQ-SHARED-110 gives list and tool pages, sinners, story chapters and announcements their own card', () => {
    for (const path of ['/decks', '/sinners', '/sinners/identities', '/sinners/ego', '/motion/skills', '/story', '/mirror-dungeon', '/planner/community', '/meta', '/tools/damage', '/calendar', '/keywords']) {
      expect(ogCardPath(path), path).toBe(`/og${path}`)
    }
    expect(ogCardPath('/sinners/faust')).toBe('/og/sinners/faust')
    expect(ogCardPath('/story/101')).toBe('/og/story/101')
    expect(ogCardPath('/announcements/3f2a')).toBe('/og/announcements/3f2a')
  })

  it('REQ-SHARED-110 leaves a page without a card on the site card', () => {
    for (const path of ['/licenses', '/sinners/nobody', '/decks/d1', '/story/abc']) expect(ogCardPath(path), path).toBeNull()
    expect(pageMetadata({ lang: 'en', path: '/licenses', title: 'Licenses', description: 'd' }).twitter?.images).toEqual(['https://saigo-no-dante.com/en/opengraph-image'])
  })

  it('REQ-SHARED-110 names every list card in Korean, English and Japanese', () => {
    for (const [path, { title }] of Object.entries(OG_SECTIONS)) {
      for (const lang of ['ko', 'en', 'ja'] as const) expect(title[lang].trim(), `${path} ${lang}`).not.toBe('')
    }
  })

  it('REQ-SHARED-110 points the page metadata at its card', () => {
    expect(pageMetadata({ lang: 'ja', path: '/story/101', title: 't', description: 'd' }).openGraph?.images)
      .toEqual([{ url: 'https://saigo-no-dante.com/ja/og/story/101', width: 1200, height: 630 }])
  })
})
