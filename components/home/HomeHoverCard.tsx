'use client'

import React from 'react'

/**
 * Thin client wrapper that applies per-card accent color hover effects.
 * Accepts serializable string props only — no icon components passed as props.
 */

interface FeatureHoverCardProps {
  accent: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function FeatureHoverCard({ accent, children, className, style }: FeatureHoverCardProps) {
  return (
    <div
      className={className}
      style={style}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = `${accent}50`
        el.style.boxShadow = `0 0 1.5rem ${accent}15, inset 0 0 1.5rem ${accent}08`
        el.style.background = `linear-gradient(135deg, ${accent}08 0%, var(--bg-card) 60%)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'none'
        el.style.background = 'var(--bg-card)'
      }}
    >
      {children}
    </div>
  )
}

interface OfficialHoverCardProps {
  color: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function OfficialHoverCard({ color, children, className, style }: OfficialHoverCardProps) {
  return (
    <div
      className={className}
      style={style}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = color + '60'
        el.style.boxShadow = `0 0 1.25rem ${color}15`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'none'
      }}
    >
      {children}
    </div>
  )
}
