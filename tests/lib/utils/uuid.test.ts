import { describe, expect, it } from 'vitest'
import { isUuid } from '@/lib/utils/uuid'

describe('isUuid', () => {
  it('8-4-4-4-12 형식만 통과한다', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true)
  })

  it('느슨한 36자나 다른 모양은 거른다', () => {
    expect(isUuid('-'.repeat(36))).toBe(false)
    expect(isUuid('123e4567e89b12d3a456426614174000')).toBe(false)
    expect(isUuid('123e4567-e89b-12d3-a456-42661417400g')).toBe(false)
    expect(isUuid('123e4567-e89b-12d3-a456-4266141740000')).toBe(false)
    expect(isUuid('')).toBe(false)
  })

  it('문자열이 아니면 거른다', () => {
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid(123)).toBe(false)
    expect(isUuid({})).toBe(false)
  })
})
