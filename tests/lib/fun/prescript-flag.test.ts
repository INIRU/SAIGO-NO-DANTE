import { describe, expect, it } from 'vitest'
import { prescriptModeOn } from '../../../lib/fun/prescript-flag'

describe('prescript mode on hold', () => {
  it('shows in development, and in production only when switched on', () => {
    expect(prescriptModeOn({ NODE_ENV: 'development' })).toBe(true)
    expect(prescriptModeOn({ NODE_ENV: 'test' })).toBe(true)
    expect(prescriptModeOn({ NODE_ENV: 'production' })).toBe(false)
    expect(prescriptModeOn({ NODE_ENV: 'production', NEXT_PUBLIC_PRESCRIPT_MODE: '1' })).toBe(true)
  })
})
