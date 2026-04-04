'use client'

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'

interface FeatureCardProps {
  href: string
  icon: LucideIcon
  tag: string
  title: string
  desc: string
  accent: string
}

export default function FeatureCard({ href, icon: Icon, tag, title, desc, accent }: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="feature-card group relative block"
      style={{
        opacity: 0,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '0.25rem',
        padding: '1.5rem',
        minHeight: '10rem',
        transition: 'border-color 0.25s, box-shadow 0.25s, background 0.25s',
      }}
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
      {/* 아이콘 */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: '2.5rem',
          height: '2.5rem',
          background: `${accent}12`,
          border: `1px solid ${accent}30`,
          marginBottom: '1rem',
          transition: 'background 0.25s, border-color 0.25s',
        }}
      >
        <Icon size={18} style={{ color: accent, opacity: 0.8, transition: 'opacity 0.25s' }} />
      </div>

      {/* 태그 */}
      <div
        className="font-mono"
        style={{
          fontSize: '0.5625rem',
          letterSpacing: '0.3em',
          color: accent,
          opacity: 0.5,
          marginBottom: '0.25rem',
        }}
      >
        {tag}
      </div>

      {/* 타이틀 */}
      <div
        className="font-serif font-light"
        style={{
          fontSize: '1.0625rem',
          color: 'var(--gold)',
          marginBottom: '0.25rem',
          transition: 'color 0.25s',
        }}
      >
        {title}
      </div>

      {/* 설명 */}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.5,
        }}
      >
        {desc}
      </div>

      {/* 쉐브론 */}
      <ChevronRight
        size={14}
        className="absolute transition-all group-hover:translate-x-0.5"
        style={{ bottom: '1rem', right: '1rem', color: '#3a2a15' }}
      />
    </Link>
  )
}
