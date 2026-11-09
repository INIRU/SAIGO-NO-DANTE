'use client'

import { useState } from 'react'
import Image, { getImageProps, type ImageProps } from 'next/image'
import { fixedSizePx, trimFixedSrcSet } from '@/lib/utils/images'

/**
 * next/image that disappears when it cannot load, leaving what it sits in: the gift slot, the card face, the keyword's text.
 * A browser draws its broken-image mark and an outline in that spot otherwise, even with an empty alt.
 * An image of one fixed size (`sizes="120px"`) lists only the widths a 1x, 2x or 3x screen picks (lib/utils/images.ts).
 */
export default function QuietImage({ src, onError, ...props }: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps['src'] | null>(null)
  if (failedSrc === src) return null
  const handleError: ImageProps['onError'] = event => {
    setFailedSrc(src)
    onError?.(event)
  }
  const fixed = fixedSizePx(props.sizes)
  if (fixed) {
    const { props: img } = getImageProps({ ...props, src })
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...img} srcSet={img.srcSet && trimFixedSrcSet(img.srcSet, fixed)} onError={handleError} />
  }
  return <Image {...props} src={src} onError={handleError} />
}
