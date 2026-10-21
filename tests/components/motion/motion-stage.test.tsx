import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import MotionStage, { MotionPendingStage } from '@/components/motion/MotionStage'

const store = { subscribe: () => () => {}, get: () => 0 }
const stage = (props: Partial<Parameters<typeof MotionStage>[0]> = {}) => renderToStaticMarkup(
  <MotionStage hostRef={{ current: null }} status="ready" error={null} playing={false} muted volume={1} hasAudio={false} frames={120} frameStore={store}
    onTogglePlay={() => {}} onStep={() => {}} onSeek={() => {}} onToggleMute={() => {}} onVolume={() => {}} onRetry={() => {}} notice={false} onDismiss={() => {}} {...props} />,
)

describe('REQ-MOTION-008 the stage credits Project Moon', () => {
  it('REQ-MOTION-008 always shows the Project Moon credit over the video, and leaves the first-visit notice to the browser', () => {
    const html = stage({ notice: null })
    expect(html).toMatch(/<span[^>]*bottom-2\.5[^>]*left-1\/2[^>]*>credit<\/span>/)
    // The notice reads the browser's memory, so the server markup never flashes it at a returning visitor.
    expect(html).not.toContain('noticeTitle')
  })

  it('REQ-MOTION-008 holds playback until the notice of this visit is dismissed: the play, frame and seek controls start disabled', () => {
    for (const notice of [null, true]) {
      const html = stage({ notice })
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="play"/)
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="nextFrame"/)
      expect(html).toMatch(/<input[^>]*aria-label="frame"[^>]*disabled=""|<input[^>]*disabled=""[^>]*aria-label="frame"/)
      expect(/<button[^>]*data-center-play[^>]*>/.exec(html)?.[0]).toContain('opacity-0')
    }
    // Dismissed: the controls work.
    expect(stage({ notice: false })).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="play"/)
  })

  it('REQ-MOTION-008 keeps the credit while loading, and offers a retry when the video fails', () => {
    expect(stage({ status: 'loading' })).toContain('>credit<')
    const failed = stage({ status: 'error', error: 'load' })
    expect(failed).toContain('loadError')
    expect(failed).toContain('retry')
    expect(failed).toContain('>credit<')
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

  it('REQ-MOTION-012 shows a play button over the middle of a paused video, and fades it out while playing or loading', () => {
    const center = (html: string) => /<button[^>]*data-center-play[^>]*>/.exec(html)?.[0] ?? ''
    expect(center(stage({ playing: false }))).toContain('opacity-100')
    expect(center(stage({ playing: true }))).toContain('opacity-0')
    expect(center(stage({ playing: false, status: 'loading' }))).toContain('opacity-0')
    // The bar's play button is the one assistive technology reads.
    expect(center(stage({ playing: false }))).toContain('tabindex="-1"')
  })
})

describe('REQ-MOTION-020 the stage of an identity without motion yet', () => {
  it('REQ-MOTION-020 says the motion is being made from in-game footage and takes 5 days to 2 weeks, in the stage frame', () => {
    const html = renderToStaticMarkup(<MotionPendingStage />)
    expect(html).toContain('pendingTitle')
    expect(html).toContain('pendingBody')
    expect(html).toContain('aspect-video')
  })
})
