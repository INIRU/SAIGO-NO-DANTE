'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

interface OfficialLinkCardProps {
  label: string
  sub: string
  href: string
  icon: LucideIcon | React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
}

export default function OfficialLinkCard({ label, sub, href, icon: Icon, color }: OfficialLinkCardProps) {
  const isInternal = href.startsWith('/')
  const linkProps = isInternal ? {} : { target: '_blank' as const, rel: 'noopener noreferrer' }
  const Wrapper = isInternal ? Link : 'a'

  return (
    <Wrapper
      href={href}
      {...linkProps}
      className="official-link-card group relative flex flex-col items-center text-center transition-all duration-300"
      style={{
        background: 'linear-gradient(160deg, #1a1510 0%, #120e08 100%)',
        border: '1px solid var(--border)',
        borderRadius: '0.25rem',
        padding: '1.5rem',
        minHeight: '9rem',
        opacity: 0,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = color + '60'
        el.style.boxShadow = `0 0 1.25rem ${color}15`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'none'
      }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: '2.5rem',
          height: '2.5rem',
          background: `${color}18`,
          border: `1px solid ${color}40`,
          marginBottom: '1rem',
        }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="font-serif font-light text-sm mb-1" style={{ color: 'var(--gold-light)' }}>
        {label}
      </div>
      <div className="truncate font-mono w-full" style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>
        {sub}
      </div>
      <ExternalLink
        size={12}
        className="absolute transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        style={{ bottom: '0.75rem', right: '0.75rem', color: '#3a2a15' }}
      />
    </Wrapper>
  )
}
