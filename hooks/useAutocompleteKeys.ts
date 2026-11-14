'use client'

import type { KeyboardEvent } from 'react'

export interface AutocompleteKeys {
  /** Whether the suggestion list is showing. */
  open: boolean
  /** How many suggestions there are. */
  count: number
  /** The highlighted suggestion, -1 for none. */
  index: number
  setOpen: (open: boolean) => void
  setIndex: (update: number | ((prev: number) => number)) => void
  /** Tab on a highlighted suggestion: what picking one does differs per search box (it also owns the focus handling). */
  onPick: (event: KeyboardEvent<HTMLInputElement>) => void
}

/** The keys of a search box with suggestions: ArrowDown opens and moves down, ArrowUp moves up (both wrap), Tab picks, Escape closes. */
export function autocompleteKeyDown({ open, count, index, setOpen, setIndex, onPick }: AutocompleteKeys, event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'ArrowDown' && !open && count > 0) {
    event.preventDefault()
    setOpen(true)
    return
  }
  if (!open || count === 0) {
    if (event.key === 'Escape') setOpen(false)
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setIndex(prev => (prev + 1) % count)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    setIndex(prev => (prev <= 0 ? count - 1 : prev - 1))
  } else if (event.key === 'Tab' && index >= 0) {
    event.preventDefault()
    onPick(event)
  } else if (event.key === 'Escape') {
    setOpen(false)
    setIndex(-1)
  }
}

/** The onKeyDown of a search box with suggestions; see autocompleteKeyDown. */
export function useAutocompleteKeys(keys: AutocompleteKeys) {
  return (event: KeyboardEvent<HTMLInputElement>) => autocompleteKeyDown(keys, event)
}
