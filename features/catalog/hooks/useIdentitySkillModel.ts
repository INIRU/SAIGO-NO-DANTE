'use client'

import { useEffect, useMemo, useState } from 'react'
import { type Skill, type Passive, SIN_COLORS, computeSkillImageIndices } from '@/lib/data/sinners'
import { selectUptieRows, selectIdentitySkills, buildSkillVariantMap, resolveUptieLevel, uptieLevels as listUptieLevels } from '@/lib/identity/skill-model'
import { computeSkillDiffs, computePassiveDiffs } from '@/features/catalog/lib/uptie-diff'

/** initialLevel: starting uptie (deck slot); a level without data resolves to the nearest one (ties: the lower). */
export function useIdentitySkillModel(skills: Skill[], passives: Passive[], initialLevel?: number | null) {
  // Every uptie level with data (I–IV); the toggle grows automatically as levels are imported.
  const uptieLevels = useMemo(() => listUptieLevels(skills, passives), [skills, passives])
  const maxLevel = uptieLevels[uptieLevels.length - 1] ?? 4
  const [selectedLevel, setUptieLevel] = useState<number | null>(initialLevel ?? null)
  const uptieLevel = selectedLevel == null ? maxLevel : resolveUptieLevel(uptieLevels, selectedLevel) ?? maxLevel
  const nextLevel = uptieLevels.find(level => level > uptieLevel) ?? null

  const [showDiff, setShowDiff] = useState(true)
  useEffect(() => {
    setShowDiff(localStorage.getItem('uptie-diff') !== 'off')
  }, [])

  const filteredSkills = useMemo(() => selectIdentitySkills(skills, uptieLevel), [skills, uptieLevel])
  const filteredPassives = useMemo(() => selectUptieRows(passives, uptieLevel), [passives, uptieLevel])

  // 선택한 단계 → 바로 다음 단계 변경점
  const skillDiffResult = useMemo(() =>
    showDiff && nextLevel != null ? computeSkillDiffs(filteredSkills, selectIdentitySkills(skills, nextLevel)) : null,
    [showDiff, nextLevel, filteredSkills, skills])
  const passiveDiffResult = useMemo(() =>
    showDiff && nextLevel != null ? computePassiveDiffs(filteredPassives, selectUptieRows(passives, nextLevel)) : null,
    [showDiff, nextLevel, filteredPassives, passives])

  const variantMap = useMemo(() => buildSkillVariantMap(filteredSkills), [filteredSkills])

  // 스킬 이미지 인덱스 맵
  const skillImgIdxMap = useMemo(() => computeSkillImageIndices(filteredSkills), [filteredSkills])

  // 스킬 이름 → 죄악 속성 색상 맵
  const skillNameColors = useMemo(() => {
    const colors: Record<string, string> = {}
    for (const s of filteredSkills) {
      colors[s.name] = SIN_COLORS[s.sin_affinity] || '#cccccc'
    }
    return colors
  }, [filteredSkills])

  return { uptieLevels, filteredSkills, filteredPassives, skillDiffResult, passiveDiffResult, variantMap, skillImgIdxMap, skillNameColors, uptieLevel, nextLevel, setUptieLevel, showDiff, setShowDiff }
}
