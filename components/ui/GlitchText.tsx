'use client'

import React from 'react'
import styles from '@/styles/components/GlitchText.module.css'

interface GlitchTextProps {
  text: string
  className?: string
  tag?: 'h1' | 'h2' | 'h3' | 'span' | 'p'
  style?: React.CSSProperties
}

export default function GlitchText({ text, className = '', tag: Tag = 'h1', style }: GlitchTextProps) {
  return (
    <Tag
      className={`${styles.glitch} ${className}`}
      data-text={text}
      style={style}
    >
      {text}
    </Tag>
  )
}
