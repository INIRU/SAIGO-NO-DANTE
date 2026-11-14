import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The worklet the player loads (features/motion/lib/sounds.ts LIMITER_URL).
const LIMITER = readFileSync(join(process.cwd(), 'public/motion-sfx-limiter.js'), 'utf8')

type Proc = { process: (i: Float32Array[][], o: Float32Array[][], p: Record<string, number[]>) => boolean }
const SR = 48000, N = 128

// The worklet source, run outside an AudioWorklet.
function worklet(): Proc {
  const g = globalThis as Record<string, unknown>
  g.sampleRate = SR
  g.AudioWorkletProcessor = class {}
  const Lim = new Function(LIMITER.replace(/registerProcessor\([^)]*\);?/, '') + '; return Lim')() as new () => Proc
  return new Lim()
}

// The first limiter (2026-10-28): the peak of the lookahead window searched sample by sample.
function reference(): Proc {
  const L = Math.max(8, Math.round(SR * 0.005)), ring = [new Float32Array(L), new Float32Array(L)], pk = new Float32Array(L)
  const atk = 1 - Math.exp(-1 / (0.0008 * SR))
  let pos = 0, gain = 1
  return {
    process(inputs, outputs, parameters) {
      const inp = inputs[0], out = outputs[0], n = out[0].length, c = Math.max(1e-6, parameters.ceiling[0]), rel = 1 - Math.exp(-1 / (Math.max(0.0005, parameters.release[0]) * SR))
      for (let i = 0; i < n; i++) {
        let p = 0
        for (let ch = 0; ch < out.length; ch++) {
          const x = inp[ch] ? inp[ch][i] : (inp[0] ? inp[0][i] : 0)
          out[ch][i] = ring[ch][pos]
          ring[ch][pos] = x
          if (Math.abs(x) > p) p = Math.abs(x)
        }
        pk[pos] = p
        let m = 0; for (let k = 0; k < L; k++) if (pk[k] > m) m = pk[k]
        const target = m > c ? c / m : 1
        gain += (target - gain) * (target < gain ? atk : rel)
        for (let ch = 0; ch < out.length; ch++) out[ch][i] *= gain
        pos = (pos + 1) % L
      }
      return true
    },
  }
}

describe('the sound limiter is light on the audio thread', () => {
  it('limits exactly as the sample-by-sample search did (bursts over the ceiling, silence, a ceiling change)', () => {
    const a = worklet(), b = reference()
    let seed = 7
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1
    for (let block = 0; block < 600; block++) {
      const loud = block % 50 < 12 ? 2.5 : block % 50 < 30 ? 0.4 : 0
      const inp = [[Float32Array.from({ length: N }, () => rnd() * loud), Float32Array.from({ length: N }, () => rnd() * loud)]]
      const params = { ceiling: [block < 300 ? 0.9 : 0.5], release: [0.05] }
      const oa = [[new Float32Array(N), new Float32Array(N)]], ob = [[new Float32Array(N), new Float32Array(N)]]
      a.process(inp, oa, params)
      b.process(inp, ob, params)
      for (let ch = 0; ch < 2; ch++) for (let i = 0; i < N; i++) expect(Math.abs(oa[0][ch][i] - ob[0][ch][i])).toBeLessThan(1e-6)
    }
  })
})
