
import type { CSSProperties } from 'react'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import egoArtwork from '@/lib/generated/ego-artwork.json'
import type { Identity } from '@/lib/types'
import { skillSlot } from '@/lib/identity/skill-model'
import { STORAGE_BASE, LCB_IDS } from '@/lib/constants/game'

/** A skill frame sprite from the game, coloured per sin (Storage ui/skill-frame/: `<sin>-<tier>`, `-glow`, `-coin`, `-<attack type>`, `mask`). */
export function getSkillFrameAssetUrl(name: string): string {
  return `${STORAGE_BASE}/ui/skill-frame/${name}.webp`
}

/** Tiny 4x4 warm-dark blur placeholder for remote images */
export const BLUR_PLACEHOLDER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVQIW2M4c+bMfwYGBgYmBgoBAAPOBAUFVsBzAAAAAElFTkSuQmCC'

/** Original formation-screen rank banners, shared by every E.G.O label. */
/** The game formation screen E.G.O class letters, lit and dark: public/assets/ego-ui/formation. */
export function getEgoFormationAsset(name: string): string {
  return `/assets/ego-ui/formation/${name}.webp`
}

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

/** 스킬 목록(skill_order, id 순 정렬)에서 이미지 인덱스 계산 (image_id가 없는 옛 행의 대체).
 *  S1→01, S2→02, S3→03, 수비→04, 변형→05, 06 ... (게임 스킬 번호 끝 두 자리와 같은 규칙).
 *  슬롯은 skillSlot(): 같은 슬롯의 두 번째부터는 변형 스킬 */
export function computeSkillImageIndices(skills: { id: string; skill_order: number; skill_type?: string | null }[]): Record<string, number> {
  const seenOrder = new Set<number>()
  const result: Record<string, number> = {}
  const variants: { id: string }[] = []
  for (const s of skills) {
    const base = skillSlot(s)
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

/**
 * Full-resolution EGO art for the detail hero. The row's own `artwork_url` (set by the sync, `{id}_cg-{hash12}.webp`) wins; EGO
 * synced before it existed fall back to the hand-kept verified map (lib/generated/ego-artwork.json), then to the small profile.
 */
export function getEgoArtworkUrl(profileUrl: string, artworkUrl?: string | null): string {
  if (artworkUrl?.trim()) return artworkUrl.trim()
  const id = profileUrl.match(/\/(\d+)_awaken_profile\.webp/)?.[1]
  const version = id && egoArtwork[id as keyof typeof egoArtwork]
  return version ? profileUrl.replace(/\d+_awaken_profile\.webp(?:\?.*)?$/, `${id}_cg-${version}.webp`) : profileUrl
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

/** Original mirror-dungeon constraint card layers (season 8 atlases), preserving atlas alpha. */
export function getConstraintAssetUrl(layer: string): string {
  return `/assets/planner/constraint-ui/md8-${layer}.webp`
}

/** The CSS pixel width of a `sizes` that is one fixed length (`120px`, `2rem`), or null when it depends on the screen. */
export function fixedSizePx(sizes: string | undefined): number | null {
  const match = sizes?.trim().match(/^(\d+(?:\.\d+)?)(px|rem)$/)
  return match ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : null
}

/**
 * A loaded image's style without the blur placeholder getImageProps puts on it. next/image clears it on load; a plain
 * <img> keeps it, and behind object-contain art (theme pack posters, gift icons) it shows as a grey frame.
 */
export function withoutBlurPlaceholder(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style) return style
  const { backgroundImage: _image, backgroundSize: _size, backgroundPosition: _position, backgroundRepeat: _repeat, ...rest } = style
  return rest
}

/**
 * Of a `w` srcset, the smallest width that fills a slot of `cssPx` on a 1x, 2x and 3x screen: the only ones a browser picks.
 * next/image lists every width the site knows for any `sizes`, about 190 characters each, so a page of small gift icons
 * carried 762KB of srcset (a plan detail, 2.8MB of HTML).
 */
export function trimFixedSrcSet(srcSet: string, cssPx: number): string {
  const entries = srcSet.split(', ').map(entry => ({ entry, width: Number(entry.slice(entry.lastIndexOf(' ') + 1, -1)) })).sort((a, b) => a.width - b.width)
  const keep = new Set([1, 2, 3].map(density => (entries.find(item => item.width >= cssPx * density) ?? entries.at(-1))?.width))
  return entries.filter(item => keep.has(item.width)).map(item => item.entry).join(', ')
}
