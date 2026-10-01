import { describe, it, expect } from 'vitest'
import {
  getLunacyProductIconUrl,
  getSinnerLogoUrl,
  getSinnerProfileUrl,
  getIdentityProfileUrl,
  getIdentityInfoUrl,
  getSkillIconUrl,
  computeSkillImageIndices,
  getIdentityImageUrl,
  getEgoArtworkUrl,
} from '@/lib/utils/images'
import { STORAGE_BASE } from '@/lib/constants/game'
import type { Identity } from '@/lib/types'

it('EGO 상세는 업로드가 검증된 CG만 사용하고 미등록 이미지는 보존한다', () => {
  const profile = `${STORAGE_BASE}/sinners/faust/ego/9%202/20205_awaken_profile.webp`
  expect(getEgoArtworkUrl(profile)).toMatch(/\/9%202\/20205_cg-[a-f0-9]{12}\.webp$/)
  expect(getEgoArtworkUrl('https://example.com/29999_awaken_profile.webp')).toBe('https://example.com/29999_awaken_profile.webp')
  expect(getEgoArtworkUrl('')).toBe('')
})

describe('REQ-CATALOG-016 getEgoArtworkUrl precedence', () => {
  const profile = `${STORAGE_BASE}/sinners/faust/ego/Hollow/20211_awaken_profile.webp`
  const stored = `${STORAGE_BASE}/sinners/faust/ego/Hollow/20211_cg-b2a9a36548b9.webp`

  it('REQ-CATALOG-016 uses the stored artwork_url before the hand-kept map and the profile', () => {
    expect(getEgoArtworkUrl(profile, stored)).toBe(stored)
    // 20205 is in lib/generated/ego-artwork.json, yet the row's own URL still wins.
    const mapped = `${STORAGE_BASE}/sinners/faust/ego/9%202/20205_awaken_profile.webp`
    const own = `${STORAGE_BASE}/sinners/faust/ego/9%202/20205_cg-aaaaaaaaaaaa.webp`
    expect(getEgoArtworkUrl(mapped, own)).toBe(own)
  })

  it('REQ-CATALOG-016 falls back to the map when artwork_url is missing, null or blank', () => {
    const mapped = `${STORAGE_BASE}/sinners/faust/ego/9%202/20205_awaken_profile.webp`
    for (const none of [undefined, null, '', '   ']) expect(getEgoArtworkUrl(mapped, none)).toMatch(/\/9%202\/20205_cg-[a-f0-9]{12}\.webp$/)
  })

  it('REQ-CATALOG-016 keeps the profile when neither artwork_url nor the map has the EGO', () => {
    for (const none of [undefined, null, '']) expect(getEgoArtworkUrl(profile, none)).toBe(profile)
    expect(getEgoArtworkUrl('', null)).toBe('')
  })
})

const mockIdentity: Identity = {
  id: 'test-id',
  sinner_id: 'ryoshu',
  name: 'Test',
  name_kr: '테스트',
  tier: 1,
  hp: 100,
  speed_min: 3,
  speed_max: 7,
  def_level: 40,
  keywords: ['출혈'],
  rarity: 3,
  game_id: '10402',
  folder_name: 'Test Identity',
}

describe('getSinnerLogoUrl', () => {
  it('수감자 로고 URL을 생성해야 한다', () => {
    expect(getSinnerLogoUrl('ryoshu')).toBe(`${STORAGE_BASE}/icons/Sinners/ryoshu.webp`)
  })
})

describe('getSinnerProfileUrl', () => {
  it('LCB 수감자 프로필 URL을 생성해야 한다', () => {
    const url = getSinnerProfileUrl('ryoshu')
    expect(url).toContain('/sinners/ryoshu/identities/LCB%20Sinner/10401_normal.webp')
  })

  it('존재하지 않는 수감자는 빈 문자열을 반환해야 한다', () => {
    expect(getSinnerProfileUrl('unknown')).toBe('')
  })
})

describe('getIdentityImageUrl', () => {
  it('레거시 10414 폴더명도 검증된 원본의 같은 URL을 사용해야 한다', () => {
    for (const suffix of ['normal', 'normal_info', 'gacksung', 'gacksung_info']) {
      const filename = `10414_${suffix}`
      const legacy = getIdentityImageUrl('ryoshu', 'Lobotomy E.G.O Faint Aroma Solitude', filename)
      const source = getIdentityImageUrl('ryoshu', 'Lobotomy E.G.O Faint Aroma & Solitude', filename)
      expect(legacy).toBe(source)
      expect(legacy).toContain('Faint%20Aroma%20%26%20Solitude')
    }
  })
  it('폴더명을 URL 인코딩해야 한다', () => {
    const url = getIdentityImageUrl('ryoshu', 'R Corp 4th Pack', 'test')
    expect(url).toContain('R%20Corp%204th%20Pack')
    expect(url).toContain('/test.webp')
  })
})

describe('getIdentityProfileUrl', () => {
  it('기본 일러스트 URL을 생성해야 한다', () => {
    const url = getIdentityProfileUrl(mockIdentity)
    expect(url).toContain('10402_normal.webp')
  })

  it('각성 일러스트 URL을 생성해야 한다', () => {
    const url = getIdentityProfileUrl(mockIdentity, true)
    expect(url).toContain('10402_gacksung.webp')
  })

  it('game_id가 없으면 빈 문자열을 반환해야 한다', () => {
    const noGameId = { ...mockIdentity, game_id: null }
    expect(getIdentityProfileUrl(noGameId)).toBe('')
  })

  it('folder_name이 없으면 빈 문자열을 반환해야 한다', () => {
    const noFolder = { ...mockIdentity, folder_name: null }
    expect(getIdentityProfileUrl(noFolder)).toBe('')
  })
})

describe('getIdentityInfoUrl', () => {
  it('기본 카드 이미지 URL을 생성해야 한다', () => {
    const url = getIdentityInfoUrl(mockIdentity)
    expect(url).toContain('10402_normal_info.webp')
  })

  it('각성 카드 이미지 URL을 생성해야 한다', () => {
    const url = getIdentityInfoUrl(mockIdentity, true)
    expect(url).toContain('10402_gacksung_info.webp')
  })
})

describe('getSkillIconUrl', () => {
  it('preserves numeric uptie sprite suffixes', () => {
    expect(getSkillIconUrl({sinner_id: 'ishmael', game_id: '10816'}, 5, {image_id: '1081605_4'})).toContain('/ishmael/1081605_4.webp')
  })
  it('uses original sprite IDs for S1/S3 variants, including borrowed artwork', () => {
    expect(getSkillIconUrl(mockIdentity, 3, {image_id:'1040205'})).toContain('/ryoshu/1040205.webp')
    expect(getSkillIconUrl(mockIdentity, 3, {image_id:'1040206'})).toContain('/ryoshu/1040206.webp')
    expect(getSkillIconUrl(mockIdentity, 1, {image_id:'1040207'})).toContain('/ryoshu/1040207.webp')
    expect(getSkillIconUrl(mockIdentity, 3, {image_id:'1011303'})).toContain('/yi-sang/1011303.webp')
    expect(getSkillIconUrl(mockIdentity, 1, {image_id:'../invalid'})).toContain('/ryoshu/1040201.webp')
  })
  it('스킬 아이콘 URL을 생성해야 한다 (2자리 패딩)', () => {
    const url = getSkillIconUrl(mockIdentity, 1)
    expect(url).toBe(`${STORAGE_BASE}/icons/skills/ryoshu/1040201.webp`)
  })

  it('인덱스가 10 이상이면 패딩 없이 생성해야 한다', () => {
    const url = getSkillIconUrl(mockIdentity, 10)
    expect(url).toBe(`${STORAGE_BASE}/icons/skills/ryoshu/1040210.webp`)
  })

  it('game_id가 없으면 빈 문자열을 반환해야 한다', () => {
    const noGameId = { ...mockIdentity, game_id: null }
    expect(getSkillIconUrl(noGameId, 1)).toBe('')
  })
})

describe('computeSkillImageIndices', () => {
  it('S1, S2, S3, 수비 순서로 인덱스를 배정해야 한다', () => {
    const skills = [
      { id: 's1', skill_order: 1 },
      { id: 's2', skill_order: 2 },
      { id: 's3', skill_order: 3 },
      { id: 's4', skill_order: 4 },
    ]
    const result = computeSkillImageIndices(skills)
    expect(result['s1']).toBe(1)
    expect(result['s2']).toBe(2)
    expect(result['s3']).toBe(3)
    expect(result['s4']).toBe(4)
  })

  it('skill_order >= 5는 S3 변형으로 처리해야 한다', () => {
    const skills = [
      { id: 's1', skill_order: 1 },
      { id: 's2', skill_order: 2 },
      { id: 's3', skill_order: 3 },
      { id: 's4', skill_order: 4 },
      { id: 's5', skill_order: 5 },
    ]
    const result = computeSkillImageIndices(skills)
    expect(result['s3']).toBe(3)
    expect(result['s5']).toBe(5) // 변형 → 5번 인덱스
  })

  it('같은 skill_order가 중복되면 변형 스킬로 처리해야 한다', () => {
    const skills = [
      { id: 's1', skill_order: 1 },
      { id: 's2', skill_order: 2 },
      { id: 's3a', skill_order: 3 },
      { id: 's4', skill_order: 4 },
      { id: 's3b', skill_order: 3 },
    ]
    const result = computeSkillImageIndices(skills)
    expect(result['s3a']).toBe(3)
    expect(result['s3b']).toBe(5)
  })

  it('빈 배열이면 빈 객체를 반환해야 한다', () => {
    expect(computeSkillImageIndices([])).toEqual({})
  })
})

it('uses distinct recovered artwork for monthly memberships and the Lunacy Hoard', async () => {
  const { readFileSync } = await import('node:fs')
  const { createHash } = await import('node:crypto')
  const hashes = new Set()
  for (const id of ['6', '21', '22']) {
    const url = getLunacyProductIconUrl(id)
    expect(url).toContain(`/resources/lunacy-${id}.webp?v=`)
    const bytes = readFileSync('public' + url.split('?')[0])
    const hash = createHash('sha256').update(bytes).digest('hex')
    expect(url).toContain(hash.slice(0, 12))
    hashes.add(hash)
  }
  expect(hashes.size).toBe(3)
})


describe('restored original portraits', () => {
  it('invalidates only the four replaced info images', () => {
    for (const id of ['10416', '10816']) {
      for (const state of ['normal', 'gacksung']) {
        expect(getIdentityImageUrl('ryoshu', 'folder', `${id}_${state}_info`)).toContain('.webp?v=20260919-info2')
        expect(getIdentityImageUrl('ryoshu', 'folder', `${id}_${state}`)).not.toContain('?')
      }
    }
    expect(getIdentityImageUrl('ryoshu', 'folder', '10415_normal_info')).not.toContain('?')
  })
})
