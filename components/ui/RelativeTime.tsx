'use client'

import { useState, useEffect } from 'react'
import { relativeTime } from '@/lib/utils/time'

/**
 * Hydration-safe 상대 시간 컴포넌트.
 * 서버/초기 클라이언트 렌더: null (빈 span) → hydration 완료 후 상대 시간으로 교체 (1분마다 갱신)
 *
 * Fixes SAIGO-NO-DANTE-2: useState 초기값에서 toLocaleDateString()을 호출하면
 * Node.js 서버와 브라우저 간 locale 처리 차이로 hydration mismatch가 발생한다.
 * null로 초기화하고 useEffect에서만 날짜 문자열을 설정하면 서버/클라이언트
 * 첫 렌더가 동일(빈 span)하므로 mismatch가 사라진다.
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
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    setText(relativeTime(date))
    const id = setInterval(() => setText(relativeTime(date)), 60_000)
    return () => clearInterval(id)
  }, [date])

  return <span className={className} style={style}>{text}</span>
}
