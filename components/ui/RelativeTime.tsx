'use client'

import { useState, useEffect } from 'react'
import { relativeTime } from '@/lib/utils/time'

/**
 * Hydration-safe 상대 시간 컴포넌트.
 * 서버: 고정 날짜 문자열 → 클라이언트: 상대 시간으로 교체 (1분마다 갱신)
 */
export default function RelativeTime({
  date,
  className,
  style,
}: {
  date: string
  className?: string
  style?: React.CSSProperties
}) {
  const [text, setText] = useState(() =>
    new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  )

  useEffect(() => {
    setText(relativeTime(date))
    const id = setInterval(() => setText(relativeTime(date)), 60_000)
    return () => clearInterval(id)
  }, [date])

  return <span className={className} style={style}>{text}</span>
}
