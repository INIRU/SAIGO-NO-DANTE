import { describe, expect, it } from 'vitest'
import { keywordIconKey, keywordIconSource } from '@/scripts/sync/keyword-icons'

/**
 * 2026-10-01 audit: `keyword_meta.icon_slug` has no `icons/keywords/<slug>.webp` for 38 of 509 keywords, but the site reads the icon
 * through `getKeywordIconUrl`, which maps a slug to an alias/variant file or a local atlas asset. Only the keywords whose own file is
 * the file the site reads can be missing for real: those 7 are the ones this step uploads.
 */
const OWN_FILE: [string, string][] = [
  ['검은 날개', 'black-wings'], ['검은 신의 가호', 'blessing-of-the-obsidian-god'], ['공격 레벨+', 'offense-level'], ['보존 신역', 'sanctum-of-conservation'],
  ['약속된 못', 'promised-nail'], ['잿빛 탄환', 'ashen-bullet'], ['진동 - 보존', 'tremor-conservation'],
]
// keyword, slug → the Storage file the site reads instead (an alias or variant of the slug).
const ALIASED: [string, string, string][] = [
  ['두번째 마탄', 'the-second-magic-bullet', 'the-seconds-magic-bullet'], ['경멸의 시선', 'gaze-of-contempt', 'gaze-of-the-contempt'],
  ['지네 독', 'centipede-venom', 'centipede-poison'], ['깊은 들숨', 'deep-inhale', 'deep-breath'],
  ['누적 소모 혈찬', 'bloodfeast-consumed', 'total-bloodfeast-consumed'], ['공용 누적 소모 혈찬', 'bloodfeast-consumed-shared', 'total-bloodfeast-consumed'],
  ['당연한 믿음', 'faith-beyond-question', 'faith-beyond-question-2'], ['심상 속 시간 대여', 'borrowed-time-of-the-fathoms', 'borrowed-time'],
  ['T사의 시간 대여', 't-corp-borrowed-time', 'borrowed-time'], ['얽혀버린 저주 부적', 'twisted-curse-talisman', 'entangled-curse-talisman'],
  ['지령[단말기] I', 'prescript-device-i', 'prescript-2'], ['지령[단말기] II', 'prescript-device-ii', 'prescript-2'],
  ['지령[단말기] III', 'index-prescript-don-2', 'prescript-2'], ['지령[단말기] IV', 'prescript-device-iv', 'prescript-2'],
  ['지령[쪽지] I', 'prescript-paper-slip-i', 'prescript-2'], ['지령[쪽지] II', 'prescript-paper-slip-ii', 'prescript-2'],
  ['지령[쪽지] III', 'index-prescript-faust-2', 'prescript-2'], ['지령[쪽지] IV', 'prescript-paper-slip-iv', 'prescript-2'],
  ['신(心) - 운명', 'shin-fate', 'shin-procuration'], ['신(心) - 지혜성[地慧星]', 'shin-dihui-star', 'shin-procuration'],
  ['얽힘', 'entanglement', 'afterimage-entanglement'], ['잔영', 'phantom-trace', 'dawns-first-crow'],
  ['점혈 - 홍루', 'nerve-strike-hong-lu', 'nerve-strike-hong-lu-2'], ['앙갚음 장부 [히스클리프]', 'book-of-vengeance-heathcliff', 'book-of-vengeance-sinclair'],
  ['중지 - 원한 문신 [큰 형님]', 'the-middle-vengeance-tattoo-great-brother', 'the-middle-vengeance-tattoo-s-great-brother-s'],
]
const LOCAL: [string, string, string][] = [
  ['일렁임【혈귀】', 'shimmering-bloodfiend', '/assets/game-ui/keywords/shimmering-bloodfiend.webp'], ['진동 폭발', 'tremor-burst', '/assets/game-ui/keywords/tremor-burst.webp'],
  ['천퇴성[天退星]', 'tiantui-star', '/assets/game-ui/keywords/tiantui-star.webp'], ['강기 [剛氣]', 'tiantui-star', '/assets/game-ui/keywords/tiantui-star.webp'],
  ['신(心) - 천퇴성[天退星]', 'shin-tiantui-star', '/assets/game-ui/keywords/shin-tiantui-star.webp'], ['강기-신 [剛氣-心]', 'shin-tiantui-star', '/assets/game-ui/keywords/shin-tiantui-star.webp'],
  ['참격', 'stat:slash', '/assets/game-ui/stats/slash.webp'],
]

describe('REQ-DATA-SYNC-040 the file the site reads for a keyword icon', () => {
  it.each(OWN_FILE)('REQ-DATA-SYNC-040 %s reads its own slug file: this is the one an upload can fill', (name, slug) => {
    expect(keywordIconSource(name, slug)).toEqual({ kind: 'storage', key: `icons/keywords/${slug}.webp`, own: true })
    expect(keywordIconKey(name, slug)).toBe(`icons/keywords/${slug}.webp`)
  })

  it.each(ALIASED)('REQ-DATA-SYNC-040 %s is drawn from another Storage file through the alias/variant table, so its slug file is not missing', (name, slug, file) => {
    expect(keywordIconSource(name, slug)).toEqual({ kind: 'storage', key: `icons/keywords/${file}.webp`, own: false })
    expect(keywordIconKey(name, slug)).toBeNull()
  })

  it.each(LOCAL)('REQ-DATA-SYNC-040 %s is drawn from the site\'s own asset %s (no version query), never from Storage', (name, slug, path) => {
    expect(keywordIconSource(name, slug)).toEqual({ kind: 'local', path })
    expect(keywordIconKey(name, slug)).toBeNull()
  })

  it('REQ-DATA-SYNC-040 a keyword without a slug has no icon source', () => {
    expect(keywordIconSource('없음', null)).toBeNull()
  })

  it('REQ-DATA-SYNC-040 of the 38 keywords the slug audit listed, 7 read their own file and 31 are drawn from an alias, a variant or a local asset', () => {
    const own = OWN_FILE.filter(([name, slug]) => keywordIconKey(name, slug))
    const other = [...ALIASED, ...LOCAL].filter(([name, slug]) => keywordIconSource(name, slug)?.kind === 'local' || keywordIconSource(name, slug)?.kind === 'storage' && !keywordIconKey(name, slug))
    expect(own).toHaveLength(7)
    expect(other.filter(([, slug]) => !slug.startsWith('stat:'))).toHaveLength(31)
  })
})
