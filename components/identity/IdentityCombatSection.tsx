'use client'

import { useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useTranslations } from 'next-intl'
import type { Identity } from '@/lib/types'
import type { useIdentitySkillModel } from './useIdentitySkillModel'
import { UPTIE_NUMERALS, UptieNumeral } from './UptieChanges'
import IdentitySkillsTab from './IdentitySkillsTab'
import IdentityPassivesTab from './IdentityPassivesTab'
import { workbenchReveal, workbenchStaggerItem } from '@/lib/animations'
import styles from '@/styles/components/SinnerDetail.module.css'

type Props = {
  level: number
  identity: Identity
  sinColor: string
  allowedKeywords: ReadonlySet<string>
  model: ReturnType<typeof useIdentitySkillModel>
}

export default function IdentityCombatSection({ identity, sinColor, allowedKeywords, model, level }: Props) {
  const [activeTab, setActiveTab] = useState<'skills' | 'passives'>('skills')
  const shouldReduceMotion = useReducedMotion()
  const t = useTranslations()
  const { uptieLevels, filteredSkills, filteredPassives, skillDiffResult, passiveDiffResult, variantMap, skillImgIdxMap, skillNameColors, uptieLevel, nextLevel, setUptieLevel, showDiff, setShowDiff } = model
  return (
    <m.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
      {/* 탭 바 + 동기화 토글 */}
      <div className={styles.tabs} role="tablist">
          {[
            { key: 'skills' as const, label: t('identity.tab.skills'), count: filteredSkills.length },
            { key: 'passives' as const, label: t('identity.tab.passives'), count: filteredPassives.length },
          ].map(tab => (
            <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
              <span className={styles.tabCount}>{tab.count}</span>
            </button>
          ))}

        {/* 데이터가 있는 동기화 단계만 (I–IV) */}
        {uptieLevels.length > 1 && (
          <div className={`${styles.segment} ${styles.tabsAside}`} role="group">
            {uptieLevels.map(n => (
              <button key={n} type="button" aria-pressed={uptieLevel === n} onClick={() => setUptieLevel(n)}
                aria-label={t('identity.uptie.level', { level: UPTIE_NUMERALS[n] ?? n })}
                style={uptieLevel === n ? undefined : { filter: 'grayscale(1)' }}>
                <UptieNumeral level={n} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 선택한 단계 → 바로 다음 단계 변경점 */}
      {nextLevel != null && (
        <div className="-mt-1 mb-3 flex justify-end">
          <button
            type="button"
            aria-pressed={showDiff}
            onClick={() => setShowDiff(d => {
              localStorage.setItem('uptie-diff', d ? 'off' : 'on')
              return !d
            })}
            className={`${styles.control} transition-colors hover:text-[var(--text-primary)]`}
            style={showDiff ? { borderColor: 'var(--gold)', color: 'var(--gold-light, #e8b030)' } : undefined}
          >
            <span aria-hidden className="grid h-3.5 w-3.5 place-items-center rounded-sm border" style={{ borderColor: showDiff ? 'var(--gold)' : '#51432d', background: showDiff ? 'var(--gold)' : 'transparent' }}>
              {showDiff && <svg viewBox="0 0 10 10" className="h-2.5 w-2.5"><path d="M2 5.2 4.2 7.4 8 2.8" fill="none" stroke="#17120c" strokeWidth="1.6" /></svg>}
            </span>
            {t('identity.uptie.nextChanges')}
            <UptieNumeral level={nextLevel} height="0.875rem" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'skills' && (
          <m.div
            key="skills"
            variants={shouldReduceMotion ? undefined : workbenchReveal}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit={shouldReduceMotion ? undefined : 'exit'}
          >
            <IdentitySkillsTab
              level={level}
              identity={identity}
              filteredSkills={filteredSkills}
              skillNameColors={skillNameColors}
              skillImgIdxMap={skillImgIdxMap}
              variantMap={variantMap}
              allowedKeywords={allowedKeywords}
              skillDiffs={skillDiffResult?.diffs}
              newSkills={skillDiffResult?.newSkills}
              nextLevel={nextLevel}
            />
          </m.div>
        )}

        {activeTab === 'passives' && (
          <m.div
            key="passives"
            variants={shouldReduceMotion ? undefined : workbenchReveal}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit={shouldReduceMotion ? undefined : 'exit'}
          >
            <IdentityPassivesTab
              filteredPassives={filteredPassives}
              sinColor={sinColor}
              skillNameColors={skillNameColors}
              allowedKeywords={allowedKeywords}
              passiveDiffs={passiveDiffResult?.diffs}
              newPassives={passiveDiffResult?.newPassives}
              nextLevel={nextLevel}
            />
          </m.div>
        )}
      </AnimatePresence>
    </m.div>

  )
}
