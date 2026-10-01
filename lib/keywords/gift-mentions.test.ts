import { describe, expect, it } from 'vitest'
import { createGiftMentionMatcher } from './gift-mentions'

const names = ['화상', '출혈', '침잠']
const refKeywords = { Combustion: '화상', Bleeding: '출혈', Sinking: '침잠' }

describe('createGiftMentionMatcher (REQ-SHARED-020)', () => {
  const mentioned = createGiftMentionMatcher(names, refKeywords)

  it('REQ-SHARED-020 finds keywords by name in the older stored text', () => {
    expect([...mentioned(['화상 3 부여', null, '출혈 2'])].sort()).toEqual(['출혈', '화상'])
    expect([...mentioned([null, undefined, ''])]).toEqual([])
  })

  it('REQ-SHARED-020 finds keywords by [Id] in raw text, through the reference table', () => {
    expect([...mentioned(['<style="highlight">[Combustion]</style> 3 부여\n[Sinking] 1'])].sort()).toEqual(['침잠', '화상'])
    expect([...mentioned(['[Unknown] 3 부여'])]).toEqual([])
  })

  it('REQ-SHARED-020 finds a keyword given only as a <link> id', () => {
    expect([...mentioned(['<link="Bleeding">피</link> 부여'])]).toEqual(['출혈'])
  })

  it('REQ-SHARED-020 does not guess keywords from plain words in raw text', () => {
    expect([...mentioned(['[Combustion] 3 부여, 출혈하지 않는다'])]).toEqual(['화상'])
  })

  it('REQ-SHARED-020 decides raw or old for each text on its own', () => {
    expect([...mentioned(['[Combustion] 1', '출혈 2 부여'])].sort()).toEqual(['출혈', '화상'])
  })
})
