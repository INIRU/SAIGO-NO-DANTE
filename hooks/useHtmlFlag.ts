'use client'

import { createElement, useLayoutEffect, useRef } from 'react'
import { useServerInsertedHTML } from 'next/navigation'

const counts = new Map<string, number>()

/**
 * Sets data-<name> on <html> while the caller is mounted and visible, so global CSS can use plain
 * html[data-…] selectors instead of document-wide :has() scans. Pages hidden by back/forward caching
 * (Activity) run this cleanup too. The server render sets the flag inline so the first paint matches.
 */
export function useHtmlFlag(name: string, on = true) {
  const inserted = useRef(false)
  useServerInsertedHTML(() => {
    if (!on || inserted.current) return null
    inserted.current = true
    return createElement('script', { dangerouslySetInnerHTML: { __html: `document.documentElement.setAttribute('data-${name}','')` } })
  })
  useLayoutEffect(() => {
    if (!on) return
    const attr = 'data-' + name, root = document.documentElement
    counts.set(attr, (counts.get(attr) ?? 0) + 1)
    root.setAttribute(attr, '')
    return () => {
      const left = (counts.get(attr) ?? 1) - 1
      counts.set(attr, left)
      if (!left) root.removeAttribute(attr)
    }
  }, [name, on])
}

/** Server-component form of useHtmlFlag. */
export function HtmlFlag({ name }: { name: string }) {
  useHtmlFlag(name)
  return null
}
