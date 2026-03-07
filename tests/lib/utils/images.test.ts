import { describe, it, expect } from 'vitest'
import {
  getSinnerLogoUrl,
  getSinnerProfileUrl,
  getIdentityProfileUrl,
  getIdentityInfoUrl,
  getSkillIconUrl,
  computeSkillImageIndices,
  getIdentityImageUrl,
} from '@/lib/utils/images'
import { STORAGE_BASE } from '@/lib/constants/game'
import type { Identity } from '@/lib/types'

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
