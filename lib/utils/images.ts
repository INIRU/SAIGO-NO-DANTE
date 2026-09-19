
import { getGameUiAsset } from '@/lib/utils/game-ui'
import skillFrameVersions from '@/lib/generated/skill-frame-versions.json'
import type { Identity } from '@/lib/types'
import { STORAGE_BASE, LCB_IDS } from '@/lib/constants/game'

/** Tiny 4x4 warm-dark blur placeholder for remote images */
export const BLUR_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVQIW2M4c+bMfwYGBgYmBgoBAAPOBAUFVsBzAAAAAElFTkSuQmCC'

/** Original formation-screen rank banners, shared by every E.G.O label. */
export function getEgoGradeBannerUrl(grade: string): string {
  return `/assets/ego-ui/rank-banners/${grade.toLowerCase()}.webp`
}

export function getSinnerLogoUrl(sinnerId: string): string {
  return `${STORAGE_BASE}/icons/Sinners/${sinnerId}.webp`
}

/** Detail UI uses bronze stat glyphs; battle skill badges use white attack glyphs. */
export function getDetailStatIconUrl(stat: 'health' | 'speed' | 'defense' | 'offense' | 'slash' | 'pierce' | 'blunt'): string {
  return getGameUiAsset(`stats/${stat}`)
}

export function getSinnerBadgeRingUrl(rarity: number): string {
  return getGameUiAsset(`rarity/${Math.min(3, Math.max(1, Math.trunc(rarity)))}`)
}

export function getSinnerProfileUrl(sinnerId: string): string {
  const id = LCB_IDS[sinnerId]
  if (!id) return ''
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/LCB%20Sinner/${id}_normal.webp`
}

export function getIdentityImageUrl(sinnerId: string, identityFolderName: string, filename: string): string {
  // Legacy appearance metadata omits '&'; the verified Drive upload retains it.
  const sourceFolder = sinnerId === 'ryoshu' && identityFolderName === 'Lobotomy E.G.O Faint Aroma Solitude'
    ? 'Lobotomy E.G.O Faint Aroma & Solitude'
    : identityFolderName
  const folder = encodeURIComponent(sourceFolder)
  // Invalidate the former full-illustration fallback after original portraits were restored.
  const revision = /^(10416|10816)_(normal|gacksung)_info$/.test(filename) ? '?v=20260919-info2' : ''
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/${folder}/${filename}.webp${revision}`
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

/**
 * Portrait (_info) URL from raw DB fields — safe to call in Server Components.
 * Use this instead of importing portraitUrl from DeckIdentityCard (client module).
 */
export function getIdentityPortraitUrl(
  sinnerId: string,
  folderName: string | null,
  gameId: string | null,
  gacksung: boolean,
): string {
  if (!gameId || !folderName) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  return getIdentityImageUrl(sinnerId, folderName, `${gameId}_${prefix}_info`)
}

export function getSkillIconUrl(identity: Pick<Identity, 'sinner_id' | 'game_id'>, imageIndex: number, skill?: { image_id?: string | null }): string {
  if (!identity.game_id) return ''
  const sprite = skill?.image_id && /^\d+(?:_\d+)?$/.test(skill.image_id)
    ? skill.image_id
    : `${identity.game_id}${String(imageIndex).padStart(2, '0')}`
  // Some transformed skills intentionally borrow another sinner's original sprite.
  const owner = Object.entries(LCB_IDS).find(([, id]) => sprite.startsWith(String(id).slice(0, 3)))?.[0] ?? identity.sinner_id
  return `${STORAGE_BASE}/icons/skills/${owner}/${sprite}.webp`
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

// ── 스킬 프레임 (죄악 × 슬롯) ─────────────────────────────────────────────
const FRAME_SINS = new Set(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'])

/** 게임 원본 아틀라스의 명암/알파를 보존하여 죄악 색상을 입힌 프레임. */
export function getSkillFrameInnerUrl(sin: string, skillSlot: number, layer: 'outline' | 'base' = 'outline'): string {
  const affinity = FRAME_SINS.has(sin) ? sin : 'neutral'
  const slot = Number.isFinite(skillSlot) ? Math.min(Math.max(Math.trunc(skillSlot), 1), 4) : 1
  // Defense shares S1's original shape; neutral uses one shape for every slot.
  // Use the same URL so repeated frames also share browser/Next image caches.
  const frameSlot = affinity === 'neutral' || slot === 4 ? 1 : slot
  const file = `${affinity}-${frameSlot}${layer === 'base' ? '-base' : ''}.webp`
  return `/assets/skill-frames/${file}?v=${skillFrameVersions[file as keyof typeof skillFrameVersions]}`
}

export function getSkillFrameBadgeUrl(sin: string): string {
  const file = `${FRAME_SINS.has(sin) ? sin : 'neutral'}-badge.webp`
  return `/assets/skill-frames/${file}?v=${skillFrameVersions[file as keyof typeof skillFrameVersions]}`
}

export function getEGOImageUrl(sinnerId: string, egoFolderName: string): string {
  const folder = encodeURIComponent(egoFolderName)
  return `${STORAGE_BASE}/sinners/${sinnerId}/ego/${folder}/`
}

/** Four original uptie frames per rarity. Default keeps the existing IV card. */
export function getIdentityCardFrameUrl(rarity: number, uptie = 4): string {
  const rank = [1, 2, 3].includes(rarity) ? rarity : 1
  const stage = [1, 2, 3, 4].includes(uptie) ? uptie : 4
  return `/assets/identity-card-frames/${rank}star/${stage}.webp`
}

/** Verified Drive resource sprites; shared by tools and future resource displays. */
export function getResourceIconUrl(resource: 'ticket-1' | 'ticket-2' | 'ticket-3' | 'ticket-4' | 'module' | 'enkephalin' | 'lunacy'): string {
  return getGameUiAsset(`resources/${resource}`)
}

export function getSinnerShardIconUrl(sinnerId: string): string | null {
  if (!Object.hasOwn(LCB_IDS, sinnerId)) return null
  return getGameUiAsset(`shards/${sinnerId}`)
}

export function getLunacyProductIconUrl(id: string): string {
  return getGameUiAsset(`resources/${['2', '3', '4', '5', '6', '21', '22'].includes(id) ? `lunacy-${id}` : 'lunacy'}`)
}

/** User-provided SELECTED/BACKUP originals; hashed filenames bypass stale sprite caches. */
export function getFormationBannerUrl(kind: 'selected' | 'backup'): string {
  return {
    backup: '/assets/game-ui/formation/backup-5252a810c322.png',
    selected: '/assets/game-ui/formation/selected-306bf9823f98.png',
  }[kind]
}

/** Original mirror-dungeon constraint card layers, preserving atlas alpha. */
export function getConstraintAssetUrl(layer: string): string {
  return `/assets/planner/constraint-ui/md7-${layer}.webp`
}
