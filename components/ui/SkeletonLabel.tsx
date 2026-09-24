'use client'
import { useTranslations } from 'next-intl'

/** Visually hidden, localized "loading" text for skeleton status regions. */
export default function SkeletonLabel() {
  return <span className="sr-only">{useTranslations('common')('loading')}</span>
}
