import type { KeyboardEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { autocompleteKeyDown } from '@/hooks/useAutocompleteKeys'

type Setter = (update: number | ((prev: number) => number)) => void

const KEYS = ['ArrowDown', 'ArrowUp', 'Tab', 'Escape', 'Enter', 'a']

function keyEvent(key: string) {
  return { key, preventDefault: vi.fn(), currentTarget: { blur: vi.fn() }, target: {} } as unknown as KeyboardEvent<HTMLInputElement> & { preventDefault: ReturnType<typeof vi.fn> }
}

/** A state the handler can act on: what it was set to, and how the index setter was called. */
function world(open: boolean, count: number, index: number) {
  const state = { open, index }
  const setOpen = vi.fn((value: boolean) => { state.open = value })
  const setIndex: Setter = update => { state.index = typeof update === 'function' ? update(state.index) : update }
  const onPick = vi.fn()
  return { state, setOpen, setIndex, onPick, options: { open, count, index, setOpen, setIndex, onPick } }
}

// The handler as DecksClient, CommunityClient, IdentityDecksTab and SinnerDetailClient each wrote it before the shared one.
function inlineHandler(e: KeyboardEvent<HTMLInputElement>, w: ReturnType<typeof world>) {
  const { open, count, index, setOpen, setIndex, onPick } = w.options
  if (e.key === 'ArrowDown' && !open && count > 0) {
    e.preventDefault()
    setOpen(true)
    return
  }
  if (!open || count === 0) {
    if (e.key === 'Escape') setOpen(false)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setIndex(prev => (prev + 1) % count)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setIndex(prev => (prev <= 0 ? count - 1 : prev - 1))
  } else if (e.key === 'Tab' && index >= 0) {
    e.preventDefault()
    onPick(e)
  } else if (e.key === 'Escape') {
    setOpen(false)
    setIndex(-1)
  }
}

describe('autocompleteKeyDown', () => {
  it('moves the highlight with the arrows and wraps at both ends', () => {
    const down = world(true, 3, 2)
    autocompleteKeyDown(down.options, keyEvent('ArrowDown'))
    expect(down.state.index).toBe(0)
    const up = world(true, 3, 0)
    autocompleteKeyDown(up.options, keyEvent('ArrowUp'))
    expect(up.state.index).toBe(2)
  })

  it('opens a closed list with ArrowDown, but only when there is something to show', () => {
    const closed = world(false, 2, 0)
    const event = keyEvent('ArrowDown')
    autocompleteKeyDown(closed.options, event)
    expect(closed.state.open).toBe(true)
    expect(event.preventDefault).toHaveBeenCalled()
    const empty = world(false, 0, -1)
    autocompleteKeyDown(empty.options, keyEvent('ArrowDown'))
    expect(empty.state.open).toBe(false)
  })

  it('hands Tab on a highlighted item to the caller, who decides what picking does', () => {
    const w = world(true, 3, 1)
    const event = keyEvent('Tab')
    autocompleteKeyDown(w.options, event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(w.onPick).toHaveBeenCalledWith(event)
    const none = world(true, 3, -1)
    const tab = keyEvent('Tab')
    autocompleteKeyDown(none.options, tab)
    expect(none.onPick).not.toHaveBeenCalled()
    expect(tab.preventDefault).not.toHaveBeenCalled()
  })

  it('closes with Escape, open or not, and drops the highlight when it was open', () => {
    const open = world(true, 3, 1)
    autocompleteKeyDown(open.options, keyEvent('Escape'))
    expect(open.state).toEqual({ open: false, index: -1 })
    const shut = world(false, 3, 1)
    autocompleteKeyDown(shut.options, keyEvent('Escape'))
    expect(shut.setOpen).toHaveBeenCalledWith(false)
    expect(shut.state.index).toBe(1)
  })

  it('leaves every other key alone', () => {
    const w = world(true, 3, 1)
    const event = keyEvent('Enter')
    autocompleteKeyDown(w.options, event)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(w.state).toEqual({ open: true, index: 1 })
  })

  it('does exactly what the four hand-written handlers did, for every key in every state', () => {
    for (const open of [true, false]) for (const count of [0, 1, 4]) for (const index of [-1, 0, 2, 3]) for (const key of KEYS) {
      const before = world(open, count, index), after = world(open, count, index)
      const eventBefore = keyEvent(key), eventAfter = keyEvent(key)
      inlineHandler(eventBefore, before)
      autocompleteKeyDown(after.options, eventAfter)
      const label = JSON.stringify({ open, count, index, key })
      expect({ label, state: after.state }).toEqual({ label, state: before.state })
      expect(after.setOpen.mock.calls, label).toEqual(before.setOpen.mock.calls)
      expect(after.onPick.mock.calls.length, label).toBe(before.onPick.mock.calls.length)
      expect(eventAfter.preventDefault.mock.calls.length, label).toBe(eventBefore.preventDefault.mock.calls.length)
    }
  })
})
