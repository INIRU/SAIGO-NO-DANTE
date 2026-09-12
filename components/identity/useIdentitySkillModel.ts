'use client'

import { useEffect, useMemo, useState } from 'react'
import { type Skill, type Passive, SIN_COLORS, computeSkillImageIndices } from '@/lib/data/sinners'
import { selectUptieRows, selectIdentitySkills, buildSkillVariantMap } from '@/lib/identity/skill-model'
import { computeSkillDiffs, computePassiveDiffs } from '@/lib/utils/uptie-diff'

export function useIdentitySkillModel(skills: Skill[], passives: Passive[]) {
  const [uptieLevel, setUptieLevel] = useState<3 | 4>(4)
  const [showDiff, setShowDiff] = useState(true)
  useEffect(() => {
    setShowDiff(localStorage.getItem('uptie-diff') !== 'off')
  }, [])
  // 동기화 단계 필터링
  const hasUptieData = useMemo(() =>
    skills.some(s => (s.uptie_level ?? 3) === 4) || passives.some(p => (p.uptie_level ?? 3) === 4),
    [skills, passives]
  )
  const filteredSkills = useMemo(() => selectIdentitySkills(skills, uptieLevel), [skills, uptieLevel])
  const filteredPassives = useMemo(() => selectUptieRows(passives, uptieLevel), [passives, uptieLevel])

  // 동기화 비교 데이터
  const level3Skills = useMemo(() =>
    skills.filter(s => (s.uptie_level ?? 3) === 3), [skills])
  const level4Skills = useMemo(() =>
    skills.filter(s => (s.uptie_level ?? 3) === 4), [skills])
  const level3Passives = useMemo(() =>
    passives.filter(p => (p.uptie_level ?? 3) === 3), [passives])
  const level4Passives = useMemo(() =>
    passives.filter(p => (p.uptie_level ?? 3) === 4), [passives])

  const skillDiffResult = useMemo(() => {
    if (uptieLevel !== 3 || !showDiff || !hasUptieData) return null
    return computeSkillDiffs(level3Skills, level4Skills)
  }, [uptieLevel, showDiff, hasUptieData, level3Skills, level4Skills])

  const passiveDiffResult = useMemo(() => {
    if (uptieLevel !== 3 || !showDiff || !hasUptieData) return null
    return computePassiveDiffs(level3Passives, level4Passives)
  }, [uptieLevel, showDiff, hasUptieData, level3Passives, level4Passives])

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

  return { hasUptieData, filteredSkills, filteredPassives, skillDiffResult, passiveDiffResult, variantMap, skillImgIdxMap, skillNameColors, uptieLevel, setUptieLevel, showDiff, setShowDiff }
}
