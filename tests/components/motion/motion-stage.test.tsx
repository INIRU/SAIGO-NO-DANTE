import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import MotionStage from '@/components/motion/MotionStage'

const store = { subscribe: () => () => {}, get: () => 0 }
const stage = (props: Partial<Parameters<typeof MotionStage>[0]> = {}) => renderToStaticMarkup(
  <MotionStage hostRef={{ current: null }} status="ready" error={null} playing={false} muted volume={1} hasAudio={false} frames={120} frameStore={store}
    onTogglePlay={() => {}} onStep={() => {}} onSeek={() => {}} onToggleMute={() => {}} onVolume={() => {}} onRetry={() => {}} {...props} />,
)

describe('REQ-MOTION-008 the stage says it is a simulation', () => {
  it('REQ-MOTION-008 always shows the simulation label over the video, and leaves the first-visit notice to the browser', () => {
    const html = stage()
    expect(html).toMatch(/<span[^>]*bottom-2\.5[^>]*left-1\/2[^>]*>simulation<\/span>/)
    // The notice reads the browser's memory, so the server markup never flashes it at a returning visitor.
    expect(html).not.toContain('noticeTitle')
  })

  it('REQ-MOTION-008 keeps the label while loading, and offers a retry when the video fails', () => {
    expect(stage({ status: 'loading' })).toContain('>simulation<')
    const failed = stage({ status: 'error', error: 'load' })
    expect(failed).toContain('loadError')
    expect(failed).toContain('retry')
    expect(failed).toContain('>simulation<')
    expect(stage({ status: 'error', error: 'webgl' })).not.toContain('retry')
  })

  it('REQ-MOTION-009 offers full screen everywhere and landscape on a phone held upright', () => {
    const html = stage()
    expect(html).toContain('aria-label="fullscreen"')
    expect(html).toMatch(/class="[^"]*\bhidden max-sm:pointer-coarse:grid[^"]*"[^>]*aria-label="landscape"/)
  })

  it('REQ-MOTION-010 has a volume slider beside the sound button that reads 0 while muted', () => {
    expect(stage({ muted: false, volume: 0.5, hasAudio: true })).toMatch(/<input[^>]*aria-label="volume"[^>]*value="0.5"/)
    expect(stage({ muted: true, volume: 0.5, hasAudio: true })).toMatch(/<input[^>]*aria-label="volume"[^>]*value="0"/)
    expect(stage({ hasAudio: false })).toMatch(/<input[^>]*aria-label="volume"[^>]*disabled=""/)
  })
})
