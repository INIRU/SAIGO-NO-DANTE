'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'

/** Keep the surrounding keyword text when its source artwork is unavailable. */
export default function KeywordIcon({ src, onError, ...props }: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps['src'] | null>(null)
  if (failedSrc === src) return null
  return <Image {...props} src={src} onError={event => {
    setFailedSrc(src)
    onError?.(event)
  }} />
}
