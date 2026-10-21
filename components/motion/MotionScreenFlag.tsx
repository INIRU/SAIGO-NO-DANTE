'use client'

import { useHtmlFlag } from '@/hooks/useHtmlFlag'

/** The motion page is a full-screen viewer: no navigation or footer while it (or its loading screen) is shown. */
export default function MotionScreenFlag() {
  useHtmlFlag('with-motion')
  return null
}
