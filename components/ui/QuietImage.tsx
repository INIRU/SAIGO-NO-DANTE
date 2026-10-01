'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'

/**
 * next/image that disappears when it cannot load, leaving what it sits in: the gift slot, the card face, the keyword's text.
 * A browser draws its broken-image mark and an outline in that spot otherwise, even with an empty alt.
 */
export default function QuietImage({ src, onError, ...props }: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps['src'] | null>(null)
  if (failedSrc === src) return null
  return <Image {...props} src={src} onError={event => {
    setFailedSrc(src)
    onError?.(event)
  }} />
}
