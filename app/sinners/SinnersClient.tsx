'use client'

import { useEffect, useRef } from 'react'
import { Sinner } from '@/lib/data/sinners'
import SinnerCard from '@/components/sinners/SinnerCard'

export default function SinnersClient({ sinners }: { sinners: Sinner[] }) {

  const animRef = useRef(false)
  useEffect(() => {
    if (animRef.current) return
    animRef.current = true
    const initGSAP = async () => {
      const { gsap } = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      // 헤더 시퀀스
      gsap.fromTo('.sinners-header-line',
        { scaleX: 0 },
        { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }
      )
      gsap.fromTo('.sinners-header-tag',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: 'power2.out' }
      )
      gsap.fromTo('.sinners-header-title',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.7, delay: 0.3, ease: 'power3.out' }
      )
      gsap.fromTo('.sinners-header-sub',
        { opacity: 0 },
        { opacity: 1, duration: 0.5, delay: 0.5, ease: 'power2.out' }
      )
      gsap.fromTo('.sinners-header-line-bottom',
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6, delay: 0.6, ease: 'power3.inOut' }
      )

      // 카드 스태거
      gsap.fromTo('.sinner-card-item',
        { opacity: 0, y: 40, scale: 0.93 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.55, stagger: 0.06, ease: 'power2.out',
          scrollTrigger: { trigger: '.sinners-grid', start: 'top 85%' },
        }
      )
    }
    initGSAP()
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto relative">

      {/* 배경 대기감 */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '50rem',
          height: '50rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, transparent 60%)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '20%',
          width: '30rem',
          height: '30rem',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,144,10,0.02) 0%, transparent 60%)',
        }} />
      </div>

      {/* 헤더 */}
      <div className="mb-12 text-center relative" style={{ zIndex: 1 }}>
        {/* 상단 장식 라인 */}
        <div className="sinners-header-line mx-auto" style={{
          width: '6rem',
          height: '0.0625rem',
          background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.5), transparent)',
          marginBottom: '1.25rem',
          transformOrigin: 'center',
          transform: 'scaleX(0)',
        }} />

        {/* 태그 */}
        <div className="sinners-header-tag font-mono" style={{
          opacity: 0,
          color: 'var(--gold-dim)',
          fontSize: '0.625rem',
          letterSpacing: '0.4em',
          marginBottom: '0.75rem',
        }}>
          LIMBUS COMPANY SINNERS
        </div>

        {/* 타이틀 */}
        <h1
          className="sinners-header-title font-serif text-4xl md:text-5xl font-bold mb-3"
          style={{ color: 'var(--gold)', opacity: 0, textShadow: '0 0 3rem rgba(200,144,10,0.15)' }}
        >
          수감자 목록
        </h1>

        {/* 서브텍스트 */}
        <p className="sinners-header-sub" style={{ color: '#888888', opacity: 0, fontSize: '0.875rem' }}>
          림버스 컴퍼니의 12인 수감자
        </p>

        {/* 하단 장식 라인 */}
        <div className="sinners-header-line-bottom mx-auto" style={{
          width: '12rem',
          height: '0.0625rem',
          background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3), var(--gold), rgba(200,144,10,0.3), transparent)',
          marginTop: '1.5rem',
          transformOrigin: 'center',
          transform: 'scaleX(0)',
        }} />
      </div>

      {/* 카드 그리드 */}
      <div className="sinners-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 relative" style={{ zIndex: 1 }}>
        {sinners.map((sinner, i) => (
          <div key={sinner.id} className="sinner-card-item" style={{ opacity: 0 }}>
            <SinnerCard sinner={sinner} index={i} />
          </div>
        ))}
      </div>

      {/* 하단 장식 */}
      <div className="mt-16 flex items-center justify-center gap-4">
        <div style={{
          width: '4rem',
          height: '0.0625rem',
          background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.2))',
        }} />
        <span className="font-mono" style={{ color: '#2a2015', fontSize: '0.5625rem', letterSpacing: '0.3em' }}>
          XII
        </span>
        <div style={{
          width: '4rem',
          height: '0.0625rem',
          background: 'linear-gradient(90deg, rgba(200,144,10,0.2), transparent)',
        }} />
      </div>
    </div>
  )
}
