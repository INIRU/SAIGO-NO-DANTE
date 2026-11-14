import type { GiftSubTab } from '@/lib/planner/gift-plan-constants'

export default function GiftSubTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: GiftSubTab; label: string; count: number }[]
  active: GiftSubTab
  onSelect: (tab: GiftSubTab) => void
}) {
  return (
    <div className="planner-gift-subtabs" style={{
      display: 'flex',
      gap: '0',
      borderBottom: '1px solid #1f1a14',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="planner-gift-subtab"
            style={{
              padding: '0.5rem 1.25rem',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
              cursor: 'pointer',
              color: isActive ? 'var(--gold-light)' : 'var(--text-muted)',
              fontSize: '0.8125rem',
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              marginBottom: '-1px',
              letterSpacing: '0.02em',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: '0.5625rem',
                background: isActive ? 'rgba(200,144,10,0.2)' : 'var(--bg-card)',
                color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                border: `1px solid ${isActive ? '#c8900a40' : '#222'}`,
                borderRadius: '0.75rem',
                padding: '0 0.375rem',
                lineHeight: 1.6,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
