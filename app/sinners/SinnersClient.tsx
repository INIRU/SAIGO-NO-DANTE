'use client'

import { useEffect } from 'react'
import { Sinner } from '@/lib/data/sinners'
import SinnerCard from '@/components/sinners/SinnerCard'

export default function SinnersClient({ sinners }: { sinners: Sinner[] }) {

  useEffect(() => {
    const initGSAP = async () => {
      const { gsap } = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      gsap.fromTo('.sinner-card-item',
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out',
          scrollTrigger: { trigger: '.sinners-grid', start: 'top 80%' } }
      )
    }
    initGSAP()
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-3" style={{ color: 'var(--gold)' }}>
          Limbus Company
        </h1>
        <p style={{ color: '#666688' }}>림버스 컴퍼니의 12인 수감자</p>
      </div>

      <div className="sinners-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {sinners.map((sinner, i) => (
          <div key={sinner.id} className="sinner-card-item" style={{ opacity: 0 }}>
            <SinnerCard sinner={sinner} index={i} />
          </div>
        ))}
      </div>
    </div>
  )
}
