import { describe, expect, it, vi } from 'vitest'
import { closeTip, openTip, type TipEntry } from '@/lib/keywords/tooltip-stack'

const tip = (depth: number): TipEntry => ({ depth, close: vi.fn() })

describe('tooltips stack', () => {
  it('a tooltip opened inside another keeps the outer one open', () => {
    const outer = tip(0), inner = tip(1)
    const stack = openTip(openTip([], outer), inner)
    expect(outer.close).not.toHaveBeenCalled()
    expect(stack).toEqual([outer, inner])
  })

  it('a tooltip closes the ones at its own depth and deeper, never the outer ones', () => {
    const a = tip(0), b = tip(1), c = tip(2), b2 = tip(1)
    const stack = openTip([a, b, c], b2)
    expect(b.close).toHaveBeenCalledOnce()
    expect(c.close).toHaveBeenCalledOnce()
    expect(a.close).not.toHaveBeenCalled()
    expect(stack).toEqual([a, b2])
  })

  it('any depth works, and reopening a tooltip does not close it', () => {
    let stack: TipEntry[] = []
    const chain = Array.from({ length: 8 }, (_, depth) => tip(depth))
    for (const entry of chain) stack = openTip(stack, entry)
    expect(stack).toHaveLength(8)
    stack = openTip(stack, chain[7])
    expect(chain[7].close).not.toHaveBeenCalled()
    expect(stack).toHaveLength(8)
  })

  it('a closed tooltip leaves the stack', () => {
    const a = tip(0), b = tip(1)
    expect(closeTip([a, b], b)).toEqual([a])
  })
})
