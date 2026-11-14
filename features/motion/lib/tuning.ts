// How the player hands a video frame to the GPU (`?gpu=0`: WebGL2, not WebGPU), and a meter to read on a real phone what each way costs.
// `?tex=r8` / `?tex=sub` / `?tex=r8sub` / `?tex=rgba` in the address picks the way by hand; `?debug=1` shows the meter.
type Upload = {
  /** the frame as one grey channel (the stacked Y, Cb, Cr planes are grey): a quarter of the texture's memory */
  grey: boolean
  /** the texture's storage made once and filled each frame, not made anew each frame */
  reuse: boolean
}

const asked = (name: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location?.search ?? '').get(name))

/** WebGPU draws the video when the browser has it; `?gpu=0` keeps the WebGL2 compositor. */
export const gpuAsked = () => asked('gpu') !== '0'

export function uploadAsked(): Upload {
  const tex = asked('tex') ?? ''
  return { grey: tex.startsWith('r8'), reuse: tex.endsWith('sub') }
}

/** The meter of `?debug=1`: a corner line with the draw time of a frame, the frames drawn a second and the frames the video dropped. Null without it. */
export function drawMeter(video: HTMLVideoElement, label: () => string): ((draw: () => void) => void) | null {
  if (asked('debug') !== '1') return null
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;left:0;bottom:0;z-index:9999;padding:4px 6px;font:11px/1.3 monospace;background:rgba(0,0,0,.75);color:#7f7;pointer-events:none;white-space:pre-wrap;max-width:100vw'
  document.body.appendChild(box)
  let n = 0, sum = 0, worst = 0, since = performance.now()
  return draw => {
    const t = performance.now()
    draw()
    const ms = performance.now() - t
    n++; sum += ms; worst = Math.max(worst, ms)
    if (t - since < 1000) return
    const q = video.getVideoPlaybackQuality?.()
    box.textContent = `${label()}\ndraw ${(sum / n).toFixed(1)} ms (max ${worst.toFixed(1)})  ${Math.round(n * 1000 / (t - since))} fps` + (q ? `\ndropped ${q.droppedVideoFrames} / ${q.totalVideoFrames}` : '')
    n = 0; sum = 0; worst = 0; since = t
  }
}
