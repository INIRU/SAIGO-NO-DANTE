'use client'

import { useEffect, useRef, useMemo } from 'react'
import { Sinner, Identity, SIN_COLORS, SinType, getIdentitySinType, getIdentitySinColor } from '@/lib/data/sinners'
import SinBadge from '@/components/ui/SinBadge'

const SIN_TYPES: SinType[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']

interface Props {
  sinners: Sinner[]
  identities: Identity[]
}

export default function MetaClient({ sinners, identities }: Props) {
  const barsRef = useRef<HTMLDivElement>(null)

  const { usageByIdentity, usageBySinner, usageBySin } = useMemo(() => {
    const byIdentity: Record<string, number> = {}
    const bySinner: Record<string, number> = {}
    const bySin: Record<string, number> = {}
    identities.forEach(identity => {
      const usage = Math.floor(Math.random() * 200 + 10)
      byIdentity[identity.id] = usage
      bySinner[identity.sinner_id] = (bySinner[identity.sinner_id] || 0) + usage
      const sin = getIdentitySinType(identity)
      if (sin) bySin[sin] = (bySin[sin] || 0) + usage
    })
    return { usageByIdentity: byIdentity, usageBySinner: bySinner, usageBySin: bySin }
  }, [identities])

  const topIdentities = useMemo(() =>
    [...identities].sort((a, b) => (usageByIdentity[b.id] || 0) - (usageByIdentity[a.id] || 0)).slice(0, 10),
    [identities, usageByIdentity]
  )
  const sinnerRanking = useMemo(() =>
    [...sinners].sort((a, b) => (usageBySinner[b.id] || 0) - (usageBySinner[a.id] || 0)),
    [sinners, usageBySinner]
  )
  const totalSinUsage = Object.values(usageBySin).reduce((a, b) => a + b, 0)
  const maxUsage = usageByIdentity[topIdentities[0]?.id] || 1

  useEffect(() => {
    const initGSAP = async () => {
      const { gsap } = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      gsap.fromTo('.usage-bar', { scaleX: 0 }, {
        scaleX: 1, duration: 0.8, stagger: 0.06, ease: 'power2.out', transformOrigin: 'left center',
        scrollTrigger: { trigger: '.usage-chart', start: 'top 75%' },
      })

      document.querySelectorAll('.count-up').forEach(el => {
        const target = parseInt(el.getAttribute('data-target') || '0')
        const proxy = { val: 0 }
        gsap.to(proxy, {
          val: target, duration: 1.2, ease: 'power2.out',
          onUpdate: () => { el.textContent = Math.round(proxy.val).toString() },
          scrollTrigger: { trigger: el, start: 'top 80%' },
        })
      })
    }
    initGSAP()
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-2" style={{ color: 'var(--gold)' }}>메타 분석</h1>
        <p style={{ color: '#666688' }}>인격 사용률 통계 및 트렌드</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="font-serif text-xl font-semibold mb-6" style={{ color: 'var(--gold-light)' }}>인격 사용률 TOP 10</h2>
          <div className="usage-chart space-y-3" ref={barsRef}>
            {topIdentities.map((identity, i) => {
              const pct = ((usageByIdentity[identity.id] || 0) / maxUsage) * 100
              const sinColor = getIdentitySinColor(identity)
              return (
                <div key={identity.id} className="flex items-center gap-3">
                  <span className="font-mono text-xs w-6 text-right" style={{ color: '#555566' }}>{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm" style={{ color: '#e8e4d8' }}>{identity.name_kr || identity.name}</span>
                      <div className="flex items-center gap-2">
                        <SinBadge sin={getIdentitySinType(identity)} size="sm" showLabel={false} />
                        <span className="count-up font-mono text-xs" data-target={usageByIdentity[identity.id] || 0} style={{ color: sinColor }}>
                          {usageByIdentity[identity.id] || 0}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="usage-bar h-full rounded" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${sinColor}80, ${sinColor})` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold mb-6" style={{ color: 'var(--gold-light)' }}>죄악 타입 분포</h2>
          <div className="card p-4 space-y-3">
            {SIN_TYPES.map(sin => {
              const val = usageBySin[sin] || 0
              const pct = totalSinUsage > 0 ? (val / totalSinUsage * 100).toFixed(1) : '0.0'
              const color = SIN_COLORS[sin]
              return (
                <div key={sin}>
                  <div className="flex items-center justify-between mb-1">
                    <SinBadge sin={sin} size="sm" />
                    <span className="font-mono text-xs" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                    <div className="usage-bar h-full rounded" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>

          <h2 className="font-serif text-xl font-semibold mt-8 mb-4" style={{ color: 'var(--gold-light)' }}>수감자별 인기도</h2>
          <div className="card p-4 space-y-2">
            {sinnerRanking.map((sinner, i) => (
              <div key={sinner.id} className="flex items-center gap-3 py-1.5">
                <span className="font-mono text-xs w-5" style={{ color: i < 3 ? 'var(--gold)' : '#555566' }}>{i + 1}</span>
                <span className="flex-1 text-sm" style={{ color: '#e8e4d8' }}>{sinner.name_kr}</span>
                <span className="font-mono text-xs" style={{ color: '#666688' }}>{usageBySinner[sinner.id] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
