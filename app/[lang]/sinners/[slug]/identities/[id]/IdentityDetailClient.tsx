'use client'

import { useState, useEffect, useMemo } from 'react'
import { identityAtLevel, skillsAtLevel, MAX_IDENTITY_LEVEL } from '@/lib/identity/level'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link } from '@/lib/i18n/navigation'
import {
  Sinner,
  Identity,
  Skill,
  Passive,
  getIdentitySinColor,
} from '@/lib/data/sinners'
import IdentityDecksTab from '@/components/sinners/IdentityDecksTab'
import IdentityPortraitSection from '@/components/identity/IdentityPortraitSection'
import IdentityInfoCard from '@/components/identity/IdentityInfoCard'
import { useIdentitySkillModel } from '@/components/identity/useIdentitySkillModel'
import IdentityCombatSection from '@/components/identity/IdentityCombatSection'
import IdentityStatsCard from '@/components/identity/IdentityStatsCard'
import IdentitySanitySection from '@/components/identity/IdentitySanitySection'
import type { SanityCondition, PanicType } from '@/lib/types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'
import styles from '@/styles/components/SinnerDetail.module.css'

interface Props {
  sinner: Sinner
  identity: Identity
  skills: Skill[]
  passives: Passive[]
  sanityConditions?: SanityCondition[]
  panicInfo?: PanicType | null
  currentSeason?: number
}

export default function IdentityDetailClient({
  sinner,
  identity,
  skills,
  passives,
  sanityConditions = [],
  panicInfo,
  currentSeason = 7,
}: Props) {
  const [level, setLevel] = useState(MAX_IDENTITY_LEVEL)
  const displayedIdentity = useMemo(() => identityAtLevel(identity, level), [identity, level])
  const displayedSkills = useMemo(() => skillsAtLevel(skills, level), [skills, level])
  const [gacksung, setGacksung] = useState(false)
  const [showFullArt, setShowFullArt] = useState(false)
  const [showArtTip, setShowArtTip] = useState(false)
  const [pageTab, setPageTab] = useState<'info' | 'decks'>('info')
  useEffect(() => {
    if (window.location.hash === '#decks') setPageTab('decks')
  }, [])
  const t = useTranslations()
  const locale = useLocale()
  const lang = locale as SupportedLang
  const shouldReduceMotion = useReducedMotion()
  const { sinMap: kwSinMap } = useKeywordData()
  const sinColor = getIdentitySinColor(identity, kwSinMap)
  const rarityNum = identity.rarity

  // 이 인격의 키워드만 허용 (화력/리듬 등 일반 단어가 키워드로 매칭되는 것 방지)
  // 스킬 설명의 [대괄호] 키워드는 formatSkillDescInner의 bracket 패턴이 별도 처리
  const allowedKeywords = useMemo(() => {
    return new Set<string>(identity.keywords || [])
  }, [identity.keywords])

  // 뒤로가기/앞으로가기 시 탭 상태 동기화
  useEffect(() => {
    const onPopState = () => {
      setPageTab(window.location.hash === '#decks' ? 'decks' : 'info')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])


  // 풀 일러스트 클릭 안내 (첫 방문 시만)
  useEffect(() => {
    if (localStorage.getItem('art-tip-seen')) return
    const timer = setTimeout(() => setShowArtTip(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  const skillModel = useIdentitySkillModel(displayedSkills, passives)


  return (
    <motion.div
      className="identity-detail-page min-h-[100dvh] pt-24 pb-16"
      variants={shouldReduceMotion ? undefined : workbenchReveal}
      initial={shouldReduceMotion ? false : 'initial'}
      animate="animate"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* 브레드크럼 */}
        <motion.div
          className="mb-6 flex flex-wrap items-center gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
          variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
        >
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            {t('sinners.title')}
          </Link>
          <span aria-hidden style={{ color: '#4a3d2c' }}>›</span>
          <Link href={`/sinners/${sinner.id}`} className="hover:text-yellow-300 transition-colors">
            {getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)}
          </Link>
          <span aria-hidden style={{ color: '#4a3d2c' }}>›</span>
          <span style={{ color: 'var(--gold)' }}>{getLocalizedName(identity, lang) || identity.name}</span>
        </motion.div>

        <motion.div
          className="space-y-6"
          variants={shouldReduceMotion ? undefined : staggerContainer(0.07, 0.06)}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
        >
          {/* 상세 정보와 덱 */}
          <motion.div
            className="identity-detail-content min-w-0 space-y-6"
            variants={shouldReduceMotion ? undefined : staggerContainer(0.06, 0.08)}
          >
            {/* 최상위 페이지 탭: 인격 정보 / 덱 */}
            <div className={styles.tabs} role="tablist">
              {([
                { key: 'info' as const, label: t('identity.pageTab.info') },
                { key: 'decks' as const, label: t('identity.pageTab.decks') },
              ]).map(tab => {
                const isActive = pageTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    onClick={() => {
                      if (pageTab !== tab.key) {
                        const hash = tab.key === 'decks' ? '#decks' : ''
                        window.history.pushState(null, '', hash || window.location.pathname + window.location.search)
                        setPageTab(tab.key)
                      }
                    }}
                    aria-selected={isActive}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {pageTab === 'decks' && (
                <motion.div
                  key="decks"
                  variants={shouldReduceMotion ? undefined : workbenchReveal}
                  initial={shouldReduceMotion ? false : 'initial'}
                  animate="animate"
                  exit={shouldReduceMotion ? undefined : 'exit'}
                >
                  <IdentityDecksTab identityId={identity.id} />
                </motion.div>
              )}

              {pageTab === 'info' && (
                <motion.div
                  key="info"
                  className="space-y-8"
                  variants={shouldReduceMotion ? undefined : staggerContainer(0.05)}
                  initial={shouldReduceMotion ? false : 'initial'}
                  animate="animate"
                  exit={shouldReduceMotion ? undefined : 'exit'}
                >
              <div className="identity-detail-hero grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] lg:gap-10">
          {/* 일러스트와 기본 정보 */}
          <motion.div className="identity-detail-portrait min-w-0" variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
          <IdentityPortraitSection
            sinner={sinner}
            identity={identity}
            gacksung={gacksung}
            setGacksung={setGacksung}
            showFullArt={showFullArt}
            setShowFullArt={setShowFullArt}
            showArtTip={showArtTip}
            setShowArtTip={setShowArtTip}
            sinColor={sinColor}
            rarityNum={rarityNum}
          />
          </motion.div>

                <div className="identity-detail-summary min-w-0 space-y-6">
              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentityInfoCard identity={identity} sinColor={sinColor} currentSeason={currentSeason} />
              </motion.div>

              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentityStatsCard identity={displayedIdentity} level={level} setLevel={setLevel} />
              </motion.div>

                </div>
              </div>

              <IdentityCombatSection level={level} identity={identity} sinColor={sinColor} allowedKeywords={allowedKeywords} model={skillModel} />





              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentitySanitySection sanityConditions={sanityConditions} panicInfo={panicInfo} />
              </motion.div>



              {/* 수감자 페이지로 돌아가기 */}
              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
              <Link
                href={`/sinners/${sinner.id}`}
                className="inline-flex min-h-11 items-center text-sm transition-colors hover:text-[var(--gold)]"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('identity.backToSinner')}
              </Link>
              </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>


    </motion.div>
  )
}
