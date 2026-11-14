'use client'

import { useEffect, useRef, useState } from 'react'

interface DocumentPip {
  requestWindow(options: { width: number; height: number; disallowReturnToOpener?: boolean }): Promise<Window>
}

const SIZE_KEY = 'limbus-assist-pip-size'
export interface CompanionSize { width: number; height: number }
function clampCompanionSize(size: CompanionSize): CompanionSize {
  return { width: Math.min(900, Math.max(320, Math.round(size.width) || 380)), height: Math.min(900, Math.max(280, Math.round(size.height) || 420)) }
}

type SizableWindow = Pick<Window, 'resizeTo' | 'closed'> & Partial<Pick<Window, 'innerWidth' | 'innerHeight' | 'outerWidth' | 'outerHeight'>>
const near = (a: CompanionSize, b: CompanionSize) => Math.abs(a.width - b.width) <= 2 && Math.abs(a.height - b.height) <= 2

/**
 * Sizes the open PiP window to the user's size. Sizes are content (inner) sizes, like requestWindow; resizeTo sets the
 * outer size, so the window frame measured at that moment is added. Each size is requested at most once per change.
 * Resize events that do not match the requested size are the user dragging the window and become the new size.
 */
export function createCompanionSizer(initial: CompanionSize) {
  let win: SizableWindow | null = null
  let size = initial
  let requested: CompanionSize | null = null
  const inner = (): CompanionSize | null => win && Number.isFinite(win.innerWidth) && Number.isFinite(win.innerHeight)
    ? { width: win.innerWidth!, height: win.innerHeight! } : null
  const apply = (force: boolean) => {
    try {
      if (!win || win.closed) { win = null; requested = null; return }
      if (!force && requested && requested.width === size.width && requested.height === size.height) return
      requested = size
      const current = inner()
      if (current && near(current, size)) return
      const frameWidth = current && Number.isFinite(win.outerWidth) ? win.outerWidth! - current.width : 0
      const frameHeight = current && Number.isFinite(win.outerHeight) ? win.outerHeight! - current.height : 0
      win.resizeTo(size.width + frameWidth, size.height + frameHeight)
    } catch { /* a browser may refuse resizeTo without a user gesture; the window keeps its size */ }
  }
  return {
    /** Size to pass to requestWindow. */
    openSize: () => size,
    attach(next: SizableWindow) { win = next; requested = size },
    detach(prev: SizableWindow) { if (win === prev) { win = null; requested = null } },
    /** The user's size changed; `force` re-applies an unchanged value (an explicit commit after a manual drag). */
    setSize(next: CompanionSize, force = false) { size = next; apply(force) },
    /** A resize event: returns the size the user dragged the window to, or null for our own resize. */
    observe(): CompanionSize | null {
      const current = inner()
      if (!current || (requested && near(current, requested))) return null
      size = clampCompanionSize(current)
      requested = size
      return size
    },
  }
}

export function useCompanionWindow() {
  const windowRef = useRef<Window | null>(null)
  const pendingRef = useRef<Promise<void> | null>(null)
  const generation = useRef(0)
  const mounted = useRef(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState<CompanionSize>({ width: 380, height: 420 })
  const [actualSize, setActualSize] = useState<CompanionSize>({ width: 380, height: 420 })
  const sizer = useRef<ReturnType<typeof createCompanionSizer> | null>(null)
  sizer.current ??= createCompanionSizer(size)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) ?? 'null') as CompanionSize | null
      if (saved && Number.isFinite(saved.width) && Number.isFinite(saved.height)) {
        const restored = clampCompanionSize(saved)
        setSize(restored)
        // The sizer is created with the default before storage is read; opening must use the stored size.
        sizer.current!.setSize(restored)
      }
    } catch { /* use defaults when storage is unavailable */ }
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false; generation.current++; windowRef.current?.close(); windowRef.current = null
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [])

  const open = (): Promise<void> => {
    if (windowRef.current && !windowRef.current.closed) {
      windowRef.current.focus()
      return Promise.resolve()
    }
    if (pendingRef.current) return pendingRef.current
    const request = (async () => {
      const api = (window as Window & { documentPictureInPicture?: DocumentPip }).documentPictureInPicture
      if (!api) throw new Error('unsupported')
      const requestGeneration = generation.current
      const pip = await api.requestWindow({ ...sizer.current!.openSize(), disallowReturnToOpener: true })
      if (!mounted.current || requestGeneration !== generation.current) { pip.close(); return }
      windowRef.current = pip
      sizer.current!.attach(pip)
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        const copy = node.cloneNode(true) as HTMLElement | HTMLLinkElement
        if (node instanceof HTMLLinkElement && copy instanceof HTMLLinkElement) copy.href = node.href
        pip.document.head.append(copy)
      })
      pip.document.documentElement.className = document.documentElement.className
      pip.document.documentElement.lang = document.documentElement.lang
      pip.document.body.className = document.body.className
      pip.document.body.style.cssText = 'margin:0;background:#0d0b08;color:#e8e0d0'
      pip.document.title = document.title
      const measure = () => {
        setActualSize({ width: pip.innerWidth, height: pip.innerHeight })
        // A drag of the expanded window becomes the normal size; stored once the drag settles.
        const manual = sizer.current!.observe()
        if (!manual) return
        setSize(manual)
        if (persistTimer.current) clearTimeout(persistTimer.current)
        persistTimer.current = setTimeout(() => {
          try { localStorage.setItem(SIZE_KEY, JSON.stringify(manual)) } catch { /* the window keeps its size */ }
        }, 300)
      }
      setActualSize({ width: pip.innerWidth, height: pip.innerHeight })
      pip.addEventListener('resize', measure)
      pip.addEventListener('pagehide', () => {
        pip.removeEventListener('resize', measure)
        sizer.current!.detach(pip)
        if (windowRef.current === pip) {
          windowRef.current = null
          if (mounted.current) setContainer(null)
        }
      }, { once: true })
      setContainer(pip.document.body)
    })()
    pendingRef.current = request
    void request.finally(() => { if (pendingRef.current === request) pendingRef.current = null }).catch(() => {})
    return request
  }

  const updateSize = (next: CompanionSize) => {
    const clamped = clampCompanionSize(next)
    setSize(clamped)
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(clamped)) } catch { /* the current window can still resize */ }
    // Explicit commits resize immediately (even to an unchanged value after a manual drag), unless collapsed.
    sizer.current!.setSize(clamped, true)
  }

  /** Closes the PiP window; its pagehide handler clears the container. */
  const close = () => { if (windowRef.current && !windowRef.current.closed) windowRef.current.close() }

  return { container, open, close, size, actualSize, updateSize }
}
