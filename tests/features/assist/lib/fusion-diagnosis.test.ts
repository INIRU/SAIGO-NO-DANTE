import { describe, expect, it } from 'vitest'
import { fusionDiagnosis, type FusionRead } from '@/features/assist/lib/fusion-evidence'

const read = (view: FusionRead['view'], observedAt: number, slots: FusionRead['slots']): FusionRead => ({ view, slots, observedAt })

describe('read diagnosis of a fusion whose materials were not all read', () => {
  it('REQ-ASSIST-069 lists the dialog, the wheel history and every read with its time and slots', () => {
    const text = fusionDiagnosis({ dialogless: true, undecided: false, count: 3, capacity: 5, firstAt: 10_000, resultAt: 10_850, wheelKnown: true, wheelKept: 12,
      reads: [read('dialog', 10_300, [{ id: '9001', score: 0.914, margin: 0.3 }, { blank: true }, null]), read('wheel', 9_700, [{ blank: true }, { blank: true }, { blank: true }])] })
    expect(text).toBe('v1;d=1;n=3/5;u=0;ref=1;kept=12;res=850|w-300:_,_,_|d300:9001@0.91/0.30,_,-')
    expect(fusionDiagnosis({ dialogless: false, count: 2, capacity: 3, firstAt: 5, wheelKnown: false, wheelKept: 0, reads: [] })).toBe('v1;d=0;n=2/3;u=0;ref=0;kept=0;res=-')
  })

  it('REQ-ASSIST-069 stays within 600 characters by dropping the reads that do not fit', () => {
    const reads = Array.from({ length: 80 }, (_, index) => read('wheel', index * 150, Array(5).fill({ id: '9123', score: 0.88, margin: 0.21 })))
    const text = fusionDiagnosis({ dialogless: true, count: 5, capacity: 5, firstAt: 0, wheelKnown: true, wheelKept: 40, reads })
    expect(text.length).toBeLessThanOrEqual(600)
    expect(text.startsWith('v1;d=1;n=5/5;u=0;ref=1;kept=40;res=-|w0:9123@0.88/0.21')).toBe(true)
    // Whole reads only: the text never ends in the middle of one.
    expect(text.endsWith('9123@0.88/0.21')).toBe(true)
  })
})
