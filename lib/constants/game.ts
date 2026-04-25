// ── Supabase Storage 기본 URL ─────────────────────────────────────────────
export const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

// ── 기본 아바타 (LCB 이상 각성 프로필) ────────────────────────────────────────
export const DEFAULT_AVATAR_URL = `${STORAGE_BASE}/sinners/yi-sang/identities/LCB%20Sinner/10101_gacksung_profile.webp`

// ── 12인 수감자 슬러그 (generateStaticParams용 — DB 불필요) ──────────────────
export const SINNER_SLUGS = [
  'yi-sang', 'faust', 'don-quixote', 'ryoshu', 'meursault',
  'hong-lu', 'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor',
]

// ── LCB 인격 ID 매핑 ────────────────────────────────────────────────────────
export const LCB_IDS: Record<string, string> = {
  'yi-sang':     '10101',
  'faust':       '10201',
  'don-quixote': '10301',
  'ryoshu':      '10401',
  'meursault':   '10501',
  'hong-lu':     '10601',
  'heathcliff':  '10701',
  'ishmael':     '10801',
  'rodion':      '10901',
  'sinclair':    '11001',
  'outis':       '11101',
  'gregor':      '11201',
}

// ── EGO 등급 색상 ───────────────────────────────────────────────────────────
export const GRADE_COLORS: Record<string, string> = {
  ZAYIN: '#667788', TETH: '#4898b0', HE: '#88a830', WAW: '#c8900a', ALEPH: '#c83040',
}

// ── 등급 아이콘/프레임/색상 ─────────────────────────────────────────────────
export const RARITY_ICON_MAP: Record<number, string> = {
  1: `${STORAGE_BASE}/icons/Rarity/1star.webp`,
  2: `${STORAGE_BASE}/icons/Rarity/2star.webp`,
  3: `${STORAGE_BASE}/icons/Rarity/3star.webp`,
}

export const RARITY_FRAME_MAP: Record<number, string> = {
  1: `${STORAGE_BASE}/icons/Rarity/0_frame.webp`,
  2: `${STORAGE_BASE}/icons/Rarity/00_frame.webp`,
  3: `${STORAGE_BASE}/icons/Rarity/000_frame.webp`,
}

export const IDENTITY_CARD_FRAME_MAP: Record<number, string> = {
  1: '/assets/identity-card-frames/1star.webp',
  2: '/assets/identity-card-frames/2star.webp',
  3: '/assets/identity-card-frames/3star.webp',
}

export const RARITY_COLORS: Record<number, { border: string; glow: string }> = {
  1: { border: '#556677', glow: 'rgba(85,102,119,0.3)' },
  2: { border: '#5588bb', glow: 'rgba(85,136,187,0.3)' },
  3: { border: '#c8900a', glow: 'rgba(200,144,10,0.4)' },
}

// ── 공격 타입 아이콘/라벨 ───────────────────────────────────────────────────
export const ATK_TYPE_ICON_MAP: Record<string, string> = {
  slash:  `${STORAGE_BASE}/icons/stats/slash.webp`,
  pierce: `${STORAGE_BASE}/icons/stats/pierce.webp`,
  blunt:  `${STORAGE_BASE}/icons/stats/blunt.webp`,
  '참격': `${STORAGE_BASE}/icons/stats/slash.webp`,
  '관통': `${STORAGE_BASE}/icons/stats/pierce.webp`,
  '타격': `${STORAGE_BASE}/icons/stats/blunt.webp`,
}

export const SKILL_TYPE_LABELS: Record<string, string> = {
  slash: '참격', pierce: '관통', blunt: '타격',
  defense: '방어', counter: '반격', evade: '회피',
}

const DEFENSE_TYPES = new Set(['evade', 'defense', 'counter'])

/** 스킬 순서 → 표시 라벨 (S1, S2, S3, 수비, S3-2 등) */
export function getSkillOrderLabel(skillOrder: number, skillType?: string): string {
  if (skillType && DEFENSE_TYPES.has(skillType)) return '수비'
  if (skillOrder === 4) return '수비'
  if (skillOrder >= 5) return `S3-${skillOrder - 3}`
  return `S${skillOrder}`
}
