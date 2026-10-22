'use client'

import { useRef, useState, type ComponentProps } from 'react'
import { Link } from '@/lib/i18n/navigation'

const REST_MS = 120

/**
 * A list card link that prefetches its (heavy) detail page only when the user shows intent, like Remix's
 * `prefetch="intent"`: the pointer rests on it for a moment, it gets keyboard focus, or a finger touches it.
 * Cards merely on screen, or passed over on the way to another, are not prefetched.
 */
export default function IntentLink({ onMouseEnter, onMouseLeave, onFocus, onTouchStart, ...props }: Omit<ComponentProps<typeof Link>, 'prefetch'>) {
  const [intent, setIntent] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = () => { clearTimeout(timer.current); setIntent(true) }
  return (
    <Link
      {...props}
      prefetch={intent}
      onMouseEnter={event => { if (!intent) timer.current = setTimeout(show, REST_MS); onMouseEnter?.(event) }}
      onMouseLeave={event => { clearTimeout(timer.current); onMouseLeave?.(event) }}
      onFocus={event => { show(); onFocus?.(event) }}
      onTouchStart={event => { show(); onTouchStart?.(event) }}
    />
  )
}
