'use client'

import { type LucideIcon } from 'lucide-react'

export interface TabItem {
  key: string
  label: string
  icon?: LucideIcon
  badge?: number | string
}

interface UnderlineTabBarProps {
  tabs: TabItem[]
  activeKey: string
  onTabChange: (key: string) => void
  className?: string
}

export default function UnderlineTabBar({ tabs, activeKey, onTabChange, className = '' }: UnderlineTabBarProps) {
  return (
    <div
      className={`flex overflow-x-auto ${className}`}
      style={{
        borderBottom: '1px solid var(--border)',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map(tab => {
        const active = activeKey === tab.key
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className="flex items-center gap-1.5 whitespace-nowrap transition-all"
            style={{
              padding: '0.625rem 0.75rem',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              background: active ? 'rgba(200,144,10,0.07)' : 'transparent',
              borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
            }}
          >
            {Icon && (
              <Icon style={{ width: '0.875rem', height: '0.875rem', opacity: active ? 1 : 0.5 }} />
            )}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  background: active ? 'rgba(13,11,8,0.25)' : 'var(--bg-elevated)',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.5625rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-md)',
                  padding: '0.0625rem 0.3125rem',
                  lineHeight: 1.4,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
