import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import MotionStage, { MotionPendingStage } from '@/components/motion/MotionStage'

const store = { subscribe: () => () => {}, get: () => 0 }
const stage = (props: Partial<Parameters<typeof MotionStage>[0]> = {}) => renderToStaticMarkup(
  <MotionStage hostRef={{ current: null }} status="ready" error={null} playing={false} muted volumes={{ master: 0.5, voice: 1, sfx: 1 }} hasAudio={false} frames={120} frameStore={store}
    onTogglePlay={() => {}} onStep={() => {}} onSeek={() => {}} onToggleMute={() => {}} onVolume={() => {}} onRetry={() => {}} notice={false} onDismiss={() => {}} {...props} />,
)

describe('REQ-MOTION-008 the stage credits Project Moon', () => {
  it('REQ-MOTION-008 draws no credit over the video (it is in the picture), and leaves the first-visit notice to the browser', () => {
    const html = stage({ notice: null })
    expect(html).not.toContain('>credit<')
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

  it('REQ-MOTION-008 offers a retry when the video fails', () => {
    const failed = stage({ status: 'error', error: 'load' })
    expect(failed).toContain('loadError')
    expect(failed).toContain('retry')
    expect(stage({ status: 'error', error: 'webgl' })).not.toContain('retry')
  })

  it('REQ-MOTION-009 offers full screen everywhere and landscape on a phone held upright', () => {
    const html = stage()
    expect(html).toContain('aria-label="fullscreen"')
    expect(html).toMatch(/class="[^"]*\bhidden max-sm:pointer-coarse:grid[^"]*"[^>]*aria-label="landscape"/)
  })

  it('REQ-MOTION-010 opens the volume panel from a button beside the sound button, off for a video without sound', () => {
    expect(stage({ hasAudio: true })).toMatch(/<button[^>]*aria-label="volume"[^>]*aria-expanded="false"/)
    expect(stage({ hasAudio: false })).toMatch(/<button[^>]*disabled=""[^>]*aria-label="volume"|<button[^>]*aria-label="volume"[^>]*disabled=""/)
  })

  it('REQ-MOTION-036 keeps the parts that change every frame (seek bar, frame counter) out of the session replay', () => {
    const html = stage()
    expect(html).toMatch(/<input[^>]*aria-label="frame"[^>]*data-sentry-block|<input[^>]*data-sentry-block[^>]*aria-label="frame"/)
    expect(html).toMatch(/<span[^>]*data-sentry-block[^>]*><span[^>]*>0<\/span> \/ 119<\/span>/)
  })

  it('REQ-MOTION-031 holds the master, voice and effects sliders at their values (also while muted), and no critical-hit switch', () => {
    const html = stage({ hasAudio: true, muted: true, volumes: { master: 0.3, voice: 0.8, sfx: 0.6 } })
    expect(html).toMatch(/<input[^>]*aria-label="volumeMaster"[^>]*value="0.3"/)
    expect(html).toMatch(/<input[^>]*aria-label="volumeVoice"[^>]*value="0.8"/)
    expect(html).toMatch(/<input[^>]*aria-label="volumeSfx"[^>]*value="0.6"/)
    expect(html).not.toContain('role="switch"')
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
