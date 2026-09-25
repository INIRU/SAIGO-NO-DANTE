'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Image, { type ImageProps } from 'next/image'
import { getBlurDataURL } from '@/lib/utils/thumbhash'

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

function resolveNumericDim(val: number | string | undefined): number | undefined {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10)
    return isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

export default function ImageWithFallback({
  fallbackType = 'default',
  showPendingText = false,
  alt,
  style,
  placeholder,
  blurDataURL,
  ...props
}: ImageWithFallbackProps) {
  const [errored, setErrored] = useState(false)
  const t = useTranslations('common')

  // Determine if image is rendered at < 40x40 — skip thumbhash blur to avoid Next.js warning
  const dimW = resolveNumericDim(props.width) ?? resolveNumericDim(style?.width as string | undefined)
  const dimH = resolveNumericDim(props.height) ?? resolveNumericDim(style?.height as string | undefined)
  const isSmallImage = dimW !== undefined && dimH !== undefined && dimW < 40 && dimH < 40

  const rawBlur = typeof props.src === 'string' ? getBlurDataURL(props.src) : undefined
  const thumbhashBlur = (isSmallImage || fallbackType === 'gift') ? undefined : rawBlur
  const effectivePlaceholder = placeholder ?? (thumbhashBlur ? 'blur' : undefined)
  const effectiveBlurDataURL = blurDataURL ?? thumbhashBlur

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
            {t('imagePending')}
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
      placeholder={effectivePlaceholder}
      blurDataURL={effectiveBlurDataURL}
      onError={() => setErrored(true)}
    />
  )
}
