'use client'

import { useEffect, useMemo, useState } from 'react'

type LocalTimeProps = {
  value: string | number | Date | null | undefined
  fallback?: string | null
  locale?: string
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle']
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle']
  className?: string
}

function formatFallback(value: LocalTimeProps['value']) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10).replace(/-/g, '.')
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (dateOnly) return `${dateOnly[1]}.${dateOnly[2]}.${dateOnly[3]}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().slice(0, 10).replace(/-/g, '.')
}

function formatDateTimeAttribute(value: LocalTimeProps['value']) {
  if (value === null || value === undefined || value === '') return undefined

  if (value instanceof Date || typeof value === 'number') {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
  }

  return String(value)
}

export default function LocalTime({
  value,
  fallback,
  locale = 'ko-KR',
  dateStyle = 'medium',
  timeStyle,
  className,
}: LocalTimeProps) {
  const initialText = useMemo(() => fallback ?? formatFallback(value) ?? '', [fallback, value])
  const [text, setText] = useState(initialText)

  useEffect(() => {
    if (!value) {
      setText('')
      return
    }

    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) {
      setText(String(value))
      return
    }

    setText(new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(date))
  }, [dateStyle, locale, timeStyle, value])

  return (
    <time className={className} dateTime={formatDateTimeAttribute(value)} suppressHydrationWarning>
      {text}
    </time>
  )
}
