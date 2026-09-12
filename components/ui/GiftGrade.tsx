import Image from 'next/image'
import type { CSSProperties } from 'react'
import { GRADE_ROMAN } from '@/lib/constants/gift'
import { getGameUiAsset } from '@/lib/utils/game-ui'

/** Shared source EX glyph; regular grades retain the existing Roman lettering. */
export default function GiftGrade({ grade, style, className }: {
  grade?: string | null
  style?: CSSProperties
  className?: string
}) {
  return <span className={className} style={style}>
    {grade === 'EX'
      ? <Image src={getGameUiAsset('gift/grade-ex')} alt="EX" width={119} height={122}
          style={{ width: '1.1em', height: '1.1em', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }} />
      : GRADE_ROMAN[grade ?? '1'] ?? grade}
  </span>
}
