'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslations } from 'next-intl'
import type { Identity } from '@/lib/types'
import type { useIdentitySkillModel } from './useIdentitySkillModel'
import IdentitySkillsTab from './IdentitySkillsTab'
import IdentityPassivesTab from './IdentityPassivesTab'
import { workbenchReveal, workbenchStaggerItem } from '@/lib/animations'

type Props = {
  identity: Identity
  sinColor: string
  allowedKeywords: Set<string>
  model: ReturnType<typeof useIdentitySkillModel>
}

export default function IdentityCombatSection({ identity, sinColor, allowedKeywords, model }: Props) {
  const [activeTab, setActiveTab] = useState<'skills' | 'passives'>('skills')
  const shouldReduceMotion = useReducedMotion()
  const t = useTranslations()
  const { hasUptieData, filteredSkills, filteredPassives, skillDiffResult, passiveDiffResult, variantMap, skillImgIdxMap, skillNameColors, uptieLevel, setUptieLevel, showDiff, setShowDiff } = model
  return (
    <motion.div variants={shouldReduceMotion ? undefined : workbenchStaggerItem}>
      {/* 탭 바 + 동기화 토글 */}
      <div className="flex items-end gap-2">
        <div
          className="flex flex-1 rounded-t-lg overflow-hidden"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
            padding: '3px 3px 0 3px',
          }}
        >
          {[
            { key: 'skills' as const, label: t('identity.tab.skills'), count: filteredSkills.length },
            { key: 'passives' as const, label: t('identity.tab.passives'), count: filteredPassives.length },
          ].map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 relative px-5 py-2.5 font-semibold rounded-t-md transition-all"
                style={{
                  background: isActive ? `${sinColor}18` : 'transparent',
                  color: isActive ? '#e8dcc8' : '#555',
                  fontSize: '0.8125rem',
                  borderTop: isActive ? `1px solid ${sinColor}40` : '1px solid transparent',
                  borderLeft: isActive ? `1px solid ${sinColor}40` : '1px solid transparent',
                  borderRight: isActive ? `1px solid ${sinColor}40` : '1px solid transparent',
                  borderBottom: 'none',
                  boxShadow: isActive ? `0 0 8px ${sinColor}15` : 'none',
                }}
              >
                <span>{tab.label}</span>
                <span
                  className="font-mono"
                  style={{
                    color: isActive ? sinColor : '#444',
                    fontSize: '0.75rem',
                    marginLeft: '10px',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* 3/4동기화 토글 + 변경점 토글 */}
        {hasUptieData && (
          <div
            className="flex rounded-t-lg overflow-hidden mb-0"
            style={{
              border: '1px solid var(--border)',
              borderBottom: 'none',
              background: 'rgba(0,0,0,0.3)',
            }}
          >
            {([3, 4] as const).map(level => {
              const isActive = uptieLevel === level
              return (
                <button
                  key={level}
                  onClick={() => setUptieLevel(level)}
                  className="px-3 py-2 text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? `${sinColor}25` : 'transparent',
                    color: isActive ? sinColor : '#555',
                    borderRight: level === 3 ? `1px solid var(--border)` : 'none',
                  }}
                >
                  {level === 3 ? t('identity.uptie.level3') : t('identity.uptie.level4')}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'skills' && (
          <motion.div
            key="skills"
            variants={shouldReduceMotion ? undefined : workbenchReveal}
            initial={shouldReduceMotion ? false : 'initial'}
            animate="animate"
            exit={shouldReduceMotion ? undefined : 'exit'}
          >
            <IdentitySkillsTab
              identity={identity}
              filteredSkills={filteredSkills}
              skillNameColors={skillNameColors}
              skillImgIdxMap={skillImgIdxMap}
              variantMap={variantMap}
              allowedKeywords={allowedKeywords}
              skillDiffs={skillDiffResult?.diffs}
              newSkills={skillDiffResult?.newSkills}
              showDiff={showDiff && uptieLevel === 3 && hasUptieData}
              onToggleDiff={() => setShowDiff(d => {
                const next = !d
                localStorage.setItem('uptie-diff', next ? 'on' : 'off')
                return next
              })}
            />
          </motion.div>
        )}

        {activeTab === 'passives' && (
          <motion.div
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
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

  )
}
