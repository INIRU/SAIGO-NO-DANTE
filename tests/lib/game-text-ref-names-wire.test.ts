import { describe, expect, it } from 'vitest'
import { compactGameTextRefNames, expandGameTextRefNames } from '@/lib/game-text/ref-names-wire'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const NAMES: GameTextRefNames = {
  Combustion: { k: 'keyword', n: '화상', kw: '화상', i: 'game-Combustion' },
  A1c971a: { k: 'keyword', n: '끓어오르는 분노', i: 'game-A1c971a' },
  Custom: { k: 'keyword', n: '다른 그림', i: 'other-file' },
  NoIcon: { k: 'keyword', n: '그림 없음' },
  StartBattle: { k: 'skilltag', n: '전투 시작' },
}

describe('REQ-SHARED-065 the layout hands the reference names down in a smaller form', () => {
  it('REQ-SHARED-065 leaves out the default kind and the icon file named after the id', () => {
    expect(compactGameTextRefNames(NAMES)).toEqual({
      Combustion: { n: '화상', kw: '화상', i: 1 },
      A1c971a: { n: '끓어오르는 분노', i: 1 },
      Custom: { n: '다른 그림', i: 'other-file' },
      NoIcon: { n: '그림 없음' },
      StartBattle: { n: '전투 시작', s: 1 },
    })
  })

  it('REQ-SHARED-065 restores exactly the names the readers get from the API', () => {
    expect(expandGameTextRefNames(compactGameTextRefNames(NAMES))).toEqual(NAMES)
  })

  it('REQ-SHARED-065 is much smaller than the full form', () => {
    expect(JSON.stringify(compactGameTextRefNames(NAMES)).length).toBeLessThan(JSON.stringify(NAMES).length * 0.7)
  })
})
