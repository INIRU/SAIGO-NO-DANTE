'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'

type FallbackType = 'identity' | 'skill' | 'ego' | 'gift' | 'theme' | 'default'

const FALLBACK_MAP: Record<FallbackType, string> = {
  identity: '/placeholders/identity.svg',
  skill: '/placeholders/skill.svg',
  ego: '/placeholders/ego.svg',
  gift: '/placeholders/gift.svg',
  theme: '/placeholders/default.svg',
  default: '/placeholders/default.svg',
}

interface ImageWithFallbackProps extends Omit<ImageProps, 'onError'> {
  fallbackType?: FallbackType
  showPendingText?: boolean
}

export default function ImageWithFallback({
  fallbackType = 'default',
  showPendingText = false,
  alt,
  style,
  ...props
}: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: '#1a1510',
          borderRadius: style?.borderRadius ?? '0.25rem',
          width: style?.width,
          height: style?.height,
          minWidth: style?.width || style?.minWidth,
          minHeight: style?.height || style?.minHeight,
          ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FALLBACK_MAP[fallbackType]}
          alt={alt || ''}
          style={{
            width: '60%',
            height: '60%',
            objectFit: 'contain',
            opacity: 0.3,
          }}
        />
        {showPendingText && (
          <span
            style={{
              position: 'absolute',
              bottom: '0.25rem',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '0.5rem',
              color: '#c8900a60',
              fontFamily: 'var(--font-heading)',
            }}
          >
            이미지 제공 예정
          </span>
        )}
      </span>
    )
  }

  return (
    <Image
      {...props}
      alt={alt || ''}
      style={style}
      onError={() => setErrored(true)}
    />
  )
}
