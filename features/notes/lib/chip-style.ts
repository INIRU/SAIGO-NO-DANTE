import type { CSSProperties } from 'react'

/** 게임 스타일 칩 공통 인라인 스타일 (clipPath 테두리 = outline 기법) */
export function chipStyle(color: string): CSSProperties {
  const c = 5
  const clip = `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`
  return {
    display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle',
    background: `linear-gradient(135deg, ${color}28 0%, ${color}10 100%)`,
    clipPath: clip,
    padding: '0.125rem 0.5rem', margin: '0 0.125rem', cursor: 'default', position: 'relative' as const,
    filter: `drop-shadow(0 0 2px ${color}40)`,
    lineHeight: 1.45,
  }
}
