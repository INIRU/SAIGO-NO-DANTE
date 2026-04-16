'use client'

import { Link } from '@/lib/i18n/navigation'
import { Users, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import ScrollReveal from '@/components/ui/ScrollReveal'
import { fadeIn } from '@/lib/animations'
import { useTranslations, useLocale } from 'next-intl'
import { useRoutePrefetch } from '@/lib/hooks/useRoutePrefetch'

export default function SinnersInteractive({ children }: { children: React.ReactNode }) {
  const t = useTranslations()
  const lang = useLocale()
  useRoutePrefetch([`/${lang}/sinners/identities`, `/${lang}/sinners/ego`])
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
        <motion.div
          className="mx-auto"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
          style={{
            width: '6rem',
            height: '0.0625rem',
            background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.5), transparent)',
            marginBottom: '1.25rem',
            transformOrigin: 'center',
          }}
        />

        {/* 태그 */}
        <motion.div
          className="font-mono"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          style={{
            color: 'var(--gold-dim)',
            fontSize: '0.625rem',
            letterSpacing: '0.4em',
            marginBottom: '0.75rem',
          }}
        >
          LIMBUS COMPANY SINNERS
        </motion.div>

        {/* 타이틀 */}
        <motion.h1
          className="text-4xl md:text-5xl font-bold mb-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.33, 1, 0.68, 1] }}
          style={{ color: 'var(--gold)', textShadow: '0 0 3rem rgba(200,144,10,0.15)', fontFamily: 'var(--font-heading)' }}
        >
          {t('sinners.title' as any)}
        </motion.h1>

        {/* 서브텍스트 */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
          style={{ color: '#888888', fontSize: '0.875rem' }}
        >
          {t('sinners.subtitle' as any)}
        </motion.p>

        {/* 하단 장식 라인 */}
        <motion.div
          className="mx-auto"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.65, 0, 0.35, 1] }}
          style={{
            width: '12rem',
            height: '0.0625rem',
            background: 'linear-gradient(90deg, transparent, rgba(200,144,10,0.3), var(--gold), rgba(200,144,10,0.3), transparent)',
            marginTop: '1.5rem',
            transformOrigin: 'center',
          }}
        />

        {/* 전체 보기 버튼 */}
        <motion.div
          className="flex items-center justify-center gap-3 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
        >
          <Link
            href="/sinners/identities"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-300 hover:scale-[1.03]"
            style={{
              border: '1px solid rgba(200,144,10,0.4)',
              color: 'var(--gold)',
              background: 'rgba(200,144,10,0.06)',
            }}
          >
            <Users size={16} />
            {t('sinners.viewAllIdentities' as any)}
          </Link>
          <Link
            href="/sinners/ego"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-300 hover:scale-[1.03]"
            style={{
              border: '1px solid rgba(200,144,10,0.4)',
              color: 'var(--gold)',
              background: 'rgba(200,144,10,0.06)',
            }}
          >
            <Sparkles size={16} />
            {t('sinners.viewAllEgo' as any)}
          </Link>
        </motion.div>
      </div>

      {/* 서버 렌더링된 카드 그리드 — children으로 주입 */}
      <ScrollReveal variant={fadeIn} as="div">
        {children}
      </ScrollReveal>

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
