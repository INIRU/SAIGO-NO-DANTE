import { expect, it } from 'vitest'
import { isMobileDevice } from '../../../lib/vision/device'

it('blocks phones and tablets by the browser device report, not by window size', () => {
  expect(isMobileDevice({ userAgentData: { mobile: true } })).toBe(true)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36' })).toBe(true)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(true)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
})

it('keeps desktop browsers, including touch-screen laptops and small windows', () => {
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0', platform: 'Win32', maxTouchPoints: 10,
    userAgentData: { mobile: false } })).toBe(false)
  expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
  expect(isMobileDevice(undefined)).toBe(false)
})
