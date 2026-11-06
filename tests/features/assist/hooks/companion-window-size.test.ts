import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { createCompanionSizer, type CompanionSize } from '@/features/assist/hooks/useCompanionWindow'

const stored: CompanionSize = { width: 500, height: 640 }

/** A window whose frame adds 34 px of title bar, like the measured Chrome Document PiP window. */
function framedWindow(inner: CompanionSize, { deny = false } = {}) {
  const win = { closed: false, innerWidth: inner.width, innerHeight: inner.height, outerWidth: inner.width, outerHeight: inner.height + 34,
    resizeTo: vi.fn((width: number, height: number) => {
      if (deny) throw new DOMException('user activation required', 'NotAllowedError')
      win.outerWidth = width; win.outerHeight = height; win.innerWidth = width; win.innerHeight = height - 34
    }) }
  const drag = (width: number, height: number) => { win.innerWidth = width; win.innerHeight = height; win.outerWidth = width; win.outerHeight = height + 34 }
  return Object.assign(win, { drag })
}

it('resizes to the chosen content size, adding the measured window frame, once per change', () => {
  const sizer = createCompanionSizer(stored)
  const pip = framedWindow(stored)
  sizer.attach(pip)
  sizer.setSize({ width: 600, height: 700 })
  expect(pip.resizeTo).toHaveBeenLastCalledWith(600, 734)
  expect([pip.innerWidth, pip.innerHeight]).toEqual([600, 700])
  sizer.setSize({ width: 600, height: 700 })
  sizer.setSize({ width: 600, height: 700 }, true)
  // Already at that size: no further resize call.
  expect(pip.resizeTo).toHaveBeenCalledTimes(1)
})

it('adopts a manual drag as the user size and re-applies an explicit commit after it', () => {
  const sizer = createCompanionSizer(stored)
  const pip = framedWindow(stored)
  sizer.attach(pip)
  expect(sizer.observe()).toBeNull()
  pip.drag(540, 700)
  expect(sizer.observe()).toEqual({ width: 540, height: 700 })
  expect(sizer.observe()).toBeNull()
  expect(sizer.openSize()).toEqual({ width: 540, height: 700 })
  // Typing the stored size again after a drag restores it exactly.
  pip.drag(560, 720)
  sizer.setSize({ width: 540, height: 700 }, true)
  expect([pip.innerWidth, pip.innerHeight]).toEqual([540, 700])
  expect(sizer.observe()).toBeNull()
})

it('opens a reopened window at the current size, skips closed windows and survives a refused resize', () => {
  const sizer = createCompanionSizer(stored)
  const first = framedWindow(stored)
  sizer.attach(first)
  sizer.detach(first)
  sizer.setSize({ width: 450, height: 500 })
  expect(first.resizeTo).not.toHaveBeenCalled()
  expect(sizer.openSize()).toEqual({ width: 450, height: 500 })
  const closed = framedWindow(stored)
  sizer.attach(closed)
  closed.closed = true
  expect(() => sizer.setSize({ width: 470, height: 520 })).not.toThrow()
  expect(closed.resizeTo).not.toHaveBeenCalled()
  const refusing = framedWindow(stored, { deny: true })
  sizer.attach(refusing)
  expect(() => sizer.setSize({ width: 480, height: 520 }, true)).not.toThrow()
  expect([refusing.innerWidth, refusing.innerHeight]).toEqual([stored.width, stored.height])
})

it('has no battle-driven sizing left: no collapse option, storage key or compact APIs in the app sources', () => {
  const root = resolve(__dirname, '../../../..')
  const files: string[] = []
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.(tsx?|json)$/.test(name)) files.push(path) } }
  for (const dir of ['app', 'components', 'lib', 'messages']) walk(join(root, dir))
  const offenders = files.filter(file => /battle-collapse|pipBattle|battleCompact|COMPACT_COMPANION_SIZE|resizeDenied|retryResize|data-companion-compact/.test(readFileSync(file, 'utf8')))
  expect(offenders.map(file => file.slice(root.length + 1))).toEqual([])
})
