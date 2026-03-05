import type { Identity } from '@/lib/types'
import { STORAGE_BASE, LCB_IDS } from '@/lib/constants/game'

export function getSinnerLogoUrl(sinnerId: string): string {
  return `${STORAGE_BASE}/icons/Sinners/${sinnerId}.webp`
}

export function getSinnerProfileUrl(sinnerId: string): string {
  const id = LCB_IDS[sinnerId]
  if (!id) return ''
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/LCB%20Sinner/${id}_normal.webp`
}

export function getIdentityImageUrl(sinnerId: string, identityFolderName: string, filename: string): string {
  const folder = encodeURIComponent(identityFolderName)
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/${folder}/${filename}.webp`
}

// ── Identity 기반 이미지 URL 함수 (DB의 game_id, folder_name 사용) ──────────

export function getIdentityProfileUrl(identity: Identity, gacksung = false): string {
  if (!identity.game_id || !identity.folder_name) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  const file = `${identity.game_id}_${prefix}`
  return getIdentityImageUrl(identity.sinner_id, identity.folder_name, file)
}

export function getIdentityInfoUrl(identity: Identity, gacksung = false): string {
  if (!identity.game_id || !identity.folder_name) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  const file = `${identity.game_id}_${prefix}_info`
  return getIdentityImageUrl(identity.sinner_id, identity.folder_name, file)
}

export function getSkillIconUrl(identity: Identity, imageIndex: number): string {
  if (!identity.game_id) return ''
  return `${STORAGE_BASE}/icons/skills/${identity.game_id}${String(imageIndex).padStart(2, '0')}.webp`
}

/** 스킬 목록(skill_order, id 순 정렬)에서 이미지 인덱스 계산.
 *  S1→01, S2→02, S3→03, 수비→04, 변형→05, 06 ...
 *  skill_order >= 5 는 S3 변형(구 데이터), 같은 skill_order 중복은 변형 스킬 */
export function computeSkillImageIndices(skills: { id: string; skill_order: number }[]): Record<string, number> {
  const seenOrder = new Set<number>()
  const result: Record<string, number> = {}
  const variants: { id: string }[] = []
  for (const s of skills) {
    const base = s.skill_order >= 5 ? 3 : s.skill_order
    if (!seenOrder.has(base)) {
      seenOrder.add(base)
      result[s.id] = base
    } else {
      variants.push(s)
    }
  }
  variants.forEach((s, i) => { result[s.id] = 5 + i })
  return result
}

export function getEGOImageUrl(sinnerId: string, egoFolderName: string): string {
  const folder = encodeURIComponent(egoFolderName)
  return `${STORAGE_BASE}/sinners/${sinnerId}/ego/${folder}/`
}
