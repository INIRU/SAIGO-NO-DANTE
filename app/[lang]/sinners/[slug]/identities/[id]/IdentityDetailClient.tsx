'use client'

import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link } from '@/lib/i18n/navigation'
import {
  Sinner,
  Identity,
  Skill,
  Passive,
  EGO,
  getIdentitySinColor,
} from '@/lib/data/sinners'
import IdentityDecksTab from '@/components/sinners/IdentityDecksTab'
import IdentityPortraitSection from '@/components/identity/IdentityPortraitSection'
import { useIdentityGuideData } from '@/components/identity/useIdentityGuideData'
import IdentityInfoCard from '@/components/identity/IdentityInfoCard'
import { useIdentitySkillModel } from '@/components/identity/useIdentitySkillModel'
import IdentityCombatSection from '@/components/identity/IdentityCombatSection'
import IdentityStatsCard from '@/components/identity/IdentityStatsCard'
import IdentityGuideSection, { type GuideData } from '@/components/identity/IdentityGuideSection'
import IdentitySanitySection from '@/components/identity/IdentitySanitySection'
import type { SanityCondition, PanicType } from '@/lib/types'
import IdentityReviewSection from '@/components/identity/IdentityReviewSection'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { staggerContainer, workbenchReveal, workbenchStaggerItem } from '@/lib/animations'

interface Props {
  sinner: Sinner
  identity: Identity
  skills: Skill[]
  passives: Passive[]
  guides?: GuideData[]
  allSinners: Sinner[]
  allIdentities: Identity[]
  allEgos: EGO[]
  egoGifts?: { name: string; keyword: string; grade: string; image_url: string | null; effect_base: string | null }[]
  sanityConditions?: SanityCondition[]
  panicInfo?: PanicType | null
  canEditGuide?: boolean
  currentSeason?: number
}

export default function IdentityDetailClient({
  sinner,
  identity,
  skills,
  passives,
  guides: initialGuides,
  allSinners,
  allIdentities,
  allEgos,
  egoGifts = [],
  sanityConditions = [],
  panicInfo,
  canEditGuide,
  currentSeason = 7,
}: Props) {
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

  const skillModel = useIdentitySkillModel(skills, passives)
  const { filteredSkills, filteredPassives, variantMap, skillImgIdxMap } = skillModel

  const { skillTokenLookup, egoTokenLookup, identityTokenLookup, egoGiftLookup, passiveLookup, acPool } = useIdentityGuideData({
    sinner, identity, filteredSkills, filteredPassives, allSinners, allIdentities, allEgos, egoGifts, variantMap, skillImgIdxMap,
  })

  return (
    <motion.div
      className="min-h-[100dvh] pt-24 pb-16"
      variants={shouldReduceMotion ? undefined : workbenchReveal}
      initial={shouldReduceMotion ? false : 'initial'}
      animate="animate"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* 브레드크럼 */}
        <motion.div
          className="mb-8 flex items-center gap-2 text-sm"
          style={{ color: '#888888' }}
          variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
        >
          <Link href="/sinners" className="hover:text-yellow-300 transition-colors">
            {t('sinners.title')}
          </Link>
          <span>›</span>
          <Link href={`/sinners/${sinner.id}`} className="hover:text-yellow-300 transition-colors">
            {getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, lang)}
          </Link>
          <span>›</span>
          <span style={{ color: sinColor }}>{getLocalizedName(identity, lang) || identity.name}</span>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-8"
          variants={shouldReduceMotion ? undefined : staggerContainer(0.07, 0.06)}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
        >
          {/* 좌측: 인격 이미지 + 이름 (1/3) */}
          <motion.div className="identity-detail-portrait" variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
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

          {/* 우측: 스탯 + 스킬 (2/3) */}
          <motion.div
            className="identity-detail-content min-w-0 space-y-8"
            variants={shouldReduceMotion ? undefined : staggerContainer(0.06, 0.08)}
          >
            {/* 최상위 페이지 탭: 인격 정보 / 덱 */}
            <div className="flex" style={{ borderBottom: '0.125rem solid var(--border)' }}>
              {([
                { key: 'info' as const, label: t('identity.pageTab.info') },
                { key: 'decks' as const, label: t('identity.pageTab.decks') },
              ]).map(tab => {
                const isActive = pageTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (pageTab !== tab.key) {
                        const hash = tab.key === 'decks' ? '#decks' : ''
                        window.history.pushState(null, '', hash || window.location.pathname + window.location.search)
                        setPageTab(tab.key)
                      }
                    }}
                    className="relative px-6 py-3 font-semibold transition-all"
                    style={{
                      color: isActive ? 'var(--gold-light)' : '#555',
                      fontSize: '0.875rem',
                      fontFamily: 'var(--font-heading)',
                      background: isActive ? 'linear-gradient(180deg, rgba(200,144,10,0.1) 0%, transparent 100%)' : 'transparent',
                      borderBottom: isActive ? `0.125rem solid ${sinColor}` : '0.125rem solid transparent',
                      marginBottom: '-0.125rem',
                      letterSpacing: '0.08em',
                    }}
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
              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentityInfoCard identity={identity} sinColor={sinColor} currentSeason={currentSeason} />
              </motion.div>

              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentityStatsCard identity={identity} sinColor={sinColor} />
              </motion.div>

              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentityGuideSection
                  identityId={identity.id}
                  initialGuides={initialGuides ?? []}
                  canEditGuide={canEditGuide}
                  sinColor={sinColor}
                  skillTokenLookup={skillTokenLookup}
                  passiveLookup={passiveLookup}
                  egoTokenLookup={egoTokenLookup}
                  identityTokenLookup={identityTokenLookup}
                  egoGiftLookup={egoGiftLookup}
                  acPool={acPool}
                />
              </motion.div>

              <IdentityCombatSection identity={identity} sinColor={sinColor} allowedKeywords={allowedKeywords} model={skillModel} />

              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentitySanitySection sanityConditions={sanityConditions} panicInfo={panicInfo} />
              </motion.div>

              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
                <IdentityReviewSection identityId={identity.id} sinColor={sinColor} />
              </motion.div>

              {/* 수감자 페이지로 돌아가기 */}
              <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
              <Link
                href={`/sinners/${sinner.id}`}
                className="block text-center py-3 font-medium text-sm transition-all duration-300 hover:border-opacity-60"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)',
                  border: '0.0625rem solid rgba(200,144,10,0.15)',
                  borderRadius: '0.375rem',
                  color: 'var(--gold-dim)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(200,144,10,0.35)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,144,10,0.1) 0%, rgba(200,144,10,0.04) 100%)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(200,144,10,0.15)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,144,10,0.06) 0%, rgba(200,144,10,0.02) 100%)'
                }}
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
